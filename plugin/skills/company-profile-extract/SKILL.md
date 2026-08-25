---
name: company-profile-extract
description: >-
  DART 정기보고서 원문(Storage에 이미 백필된 사업보고서 섹션)을 규칙 기반으로 파싱해
  FnGuide 기업개요 화면의 5블록(최근연혁·연구개발비·부문별매출·시장점유율·주주현황)을
  fin_details/corp_history 에 적재한다. 사용자가 "이 회사 프로필 채워줘", "연혁·R&D·
  부문매출 적재해줘", "FnGuide 기업개요 데이터 채워줘", "사업보고서에서 뽑아서 넣어줘"
  라고 하거나, fin_details/corp_history 를 특정 회사에 대해 채우라고 요청하면 이 스킬을
  쓴다. 삼성전자(00126380) 파일럿으로 절차·게이트가 검증됐다. DART API 호출 없음(Storage
  원문만 읽는다). 규칙 기반이 우선(extracted_by='rule')이고, 연혁·부문별매출·시장점유율
  3블록만 규칙이 0행일 때 `--llm-fallback`으로 Claude API 폴백(extracted_by='llm:...')을
  붙일 수 있다(2026-08-25 추가, 기본 꺼짐).
---

# 기업 프로필 추출 (FnGuide 5블록 → fin_details/corp_history)

Storage에 이미 백필된 사업보고서 섹션(`docs/<corp_code>/<rcept_no>.sections.json.gz`)을
마크다운 표 파서로 읽어 5블록을 규칙 기반으로 추출하고, 게이트를 통과한 사실만
`fin_details`(수치, long 테이블) / `corp_history`(연혁, 비수치)에 적재한다. 삼성전자
사업보고서 2건(20260310002820=2025 회계연도, 20250311001085=2024 회계연도) 파일럿으로
검증했다 — 근거 전문은 이 스킬의 `references/` (`fnguide-추출-계획.md`·`pilot-samsung-report.md`·`report-items-파생-설계.md`).

## 언제 규칙, 언제 LLM/확인불가인가 (파일럿이 확정한 경계)

파일럿의 핵심 발견: 규칙 기반이 못 뚫는 벽은 표 구조 자체가 아니라 ①보고서 회차마다
표 모양이 달라지는 것 ②사업보고서와 FnGuide 화면의 정보 구조 자체가 다른 것(원문에
대응 항목이 아예 없음) 이었다. 후자는 LLM 을 붙여도 없는 숫자를 만들어낼 수 없다.

| 상황 | 처리 |
|---|---|
| 표가 마크다운으로 구조화돼 있고 라벨이 안정적(R&D·연혁·시장점유율·최대주주등·5%개별) | 규칙 |
| 2단 헤더+rowspan 이 겹쳐 부문명 화이트리스트 없이 못 푸는 표(부문별 요약재무현황) | 화이트리스트 규칙(회사별로 등록 필요) — 미등록 회사는 확인불가, 다음 단계 LLM 폴백 후보 |
| 원문에 FnGuide 카테고리에 대응하는 항목 자체가 없음(임원 지분, 5%이상 합계) | 확인불가 1급 레코드(amount NULL + status에 사유) — 지어내지 않는다 |
| rowspan/colspan 붕괴로 열이 밀리는 것 | 일반 규칙 2가지로 해결(아래) — 회사마다 재발명 불필요 |

**병합 셀 붕괴 일반 규칙(파일럿 §0-2, 회사 무관하게 재사용 가능):**
1. 열 수가 헤더보다 하나 적으면 "맨 앞 칸이 사라진 continuation 행"(rowspan 이 위 행에만
   있고 아래 행은 밀림) — 연혁 표, 5%이상 주주 표에서 실측.
2. 데이터 없는 칸을 끝에 `—`(em dash) 필러로 채워 열 수를 맞추는 행 — 먼저 끝의 `—` 를
   걷어낸 뒤 실제 값 개수로 continuation 여부를 판단해야 한다(헤더 열 수와 단순 비교하면
   안 됨).

**보고서 회차 간 표 변형(파일럿 §0-1, 실측 사례 — 이 스킬이 견뎌야 하는 회귀 케이스):**
같은 회사의 R&D 표에서 '연구개발비(비용)' 행이 최신 보고서는 `회계 처리 | 연구개발비(비용)
| 값 값 값` 한 행(그룹라벨+실라벨이 합쳐져 값이 한 칸 밀림)인데, 직전 보고서는 `연구개발비
(비용) | 값 값 값` 로 독립돼 있다. `scripts/extract_profile.py` 의 `RD_LABEL_RULES` 는
라벨이 0번 칸에 곧바로 있는 경우(shift=0)와 그룹 라벨 뒤 1번 칸에 있는 경우(shift=1)를
둘 다 라벨 문자열로 매칭한다 — 열 인덱스 고정 매핑을 하지 않는다. 새 회사·회차에서 또
다른 변형이 나오면 `RD_LABEL_RULES`에 매칭 규칙을 추가하되, **기존 두 보고서가 여전히
통과하는지(both-pass) 반드시 재확인**한다(아래 "회귀 확인" 참고).

## FnGuide 블록 → concept 매핑표 (반복 가능성의 기준 — 항상 이 표와 코드를 맞춘다)

| FnGuide 블록 | 원문 위치(섹션) | fin_details concept / corp_history | item_name | unit | value_basis 예 |
|---|---|---|---|---|---|
| 최근연혁 | I.2 회사의 연혁 | `corp_history` | — | — | — |
| 연구개발비 지출(금액) | II.6.나 연구개발활동 | `rnd_total` | 연구개발비용_총계(세전) / 연구개발비용_계(세후) / 정부보조금 / 연구개발비(비용)_회계처리 / 개발비_자산화(무형자산) | KRW | 세전/세후 |
| 연구개발비 지출(매출비중) | 〃 | `rnd_revenue_ratio` | 매출액비중_필자게재 | pct | 원문게재_반올림1자리 |
| 매출비중 추이(부문별 매출) | II.4.가 매출실적 | `segment_revenue` | 부문명 / 기타(부문간내부거래제거등) / 합계 | KRW | — |
| 부문별 매출비중 | II.7.라 요약재무현황(★화이트리스트) | `segment_revenue_pct` | 부문명 | pct | — |
| 부문별 영업이익(+비중) | 〃 | `segment_operating_income`(`_pct`) | 부문명 | KRW/pct | — |
| 부문별 총자산(+비중) | 〃 | `segment_total_assets`(`_pct`) | 부문명 | KRW/pct | — |
| 주요제품 시장점유율 | II.2 주요 제품 및 서비스 | `market_share` | `<제품>|<세부항목>` | pct | — |
| 주주 구분별 지분현황 — 최대주주등 | VII.1 | `shareholding_pct` | 최대주주등_계_보통주 | pct | 기말 |
| 〃 — 5%이상(개별) | VII.4.가 | `shareholding_pct` | 5%이상_<주주명> | pct | 개별_원문 |
| 〃 — 5%이상(합계) | 〃 | `shareholding_pct` | 5%이상_합계 | — | **확인불가**(원문에 합계 카테고리 없음) |
| 〃 — 임원 | VII 전체 | `shareholding_pct` | 임원 | — | **확인불가**(원문에 없음, 추정출처: 임원ㆍ주요주주소유상황보고서) |
| 〃 — 자사주 | I.4.가 (섹션 다름 주의) | `shareholding_pct` | 자사주_원문반올림 / 자사주_정밀계산 | pct | 원문반올림1자리 / 정밀계산 |

- `segment_revenue`(부문별 매출 절대금액)는 '가. 매출실적' 표에서만 뽑는다. '라. 사업부문별
  요약 재무 현황' 표에도 같은 매출액이 다시 나오지만 **같은 자연키(corp_code·period_key·
  concept·item_name·source_rcept_no)로 다시 적재하면 충돌한다** — 그 표에서는 `_pct`(비중)
  만 뽑는다. 영업이익·총자산은 그 표에만 있는 정보라 금액·비중 둘 다 뽑는다.
- `SEGMENT_SUMMARY_WHITELIST`(스크립트 상단)에 없는 corp_code 는 segment_revenue_pct·
  segment_operating_income(_pct)·segment_total_assets(_pct) 전체가 확인불가로 스킵된다 —
  2단 헤더+rowspan 표는 부문명 화이트리스트 없이 규칙화되지 않는다(파일럿 §4-6). 새 회사를
  추가하려면 그 회사의 부문명·지표명 집합을 화이트리스트에 등록하거나, 그마저 안 되면
  LLM 폴백 후보로 남긴다(이번 단계 범위 밖).
- `period_key`: 기수(제N기) 기반 표는 `infer_period_labels`가 세 경로를 순서대로 시도해
  연도를 매긴다(2026-08-25 3사 재현시험 §B — 원래 ①만 있었는데, 부국증권·삼양식품·
  동신건설 사업보고서 전수 검색 결과 ①의 앵커 문장이 세 회사 다 **0회** 등장해 R&D·
  부문매출이 통째로 0행이 됐다): ① 본문의 `'YYYY년(제N기)'` 앵커 문장(삼성전자 관용구,
  DART 표준 문구는 아니다) ② 표 헤더 열 자체가 이미 연도를 담고 있는 경우(`20XX년`·
  `20XX.MM`) ③ 둘 다 없으면 `filings.report_nm`(`사업보고서 (YYYY.MM)`)에서 이 rcept_no
  의 회계연도를 구해, DART 관행상 표의 첫 period 컬럼이 항상 최신 회차라는 전제로 나머지를
  역산한다. 기수→연도 표를 하드코딩하지 않는 원칙은 그대로다. 어느 경로로 라벨을 얻었는지
  `notes`에 항상 남는다(`R&D: 기간 라벨 획득 경로=...`). 세 경로 다 실패하면 라벨 매칭이
  성공했더라도 period_key(NOT NULL)를 채울 수 없어 적재하지 않는다 — 다만 몇 건이
  매칭됐었는지는 notes에 남긴다(조용한 0행 방지). 주주·자사주처럼 표 자체에 연도 라벨이
  없는 시점형 개념은 여전히 `filings.report_nm`에서 그 rcept_no 의 회계연도를 가져와 채운다.

## 절차

1. **대상 확인**: `--corps <corp_code,...>` (필수), `--rcepts <rcept_no,...>` (생략 시
   회사별 최신 사업보고서 1건을 filings 테이블에서 자동 선택).
2. **Storage 섹션 확인**: `docs/<corp_code>/<rcept_no>.sections.json.gz` 가 없으면(Phase 3
   백필 미완료) 그 회차는 확인불가로 스킵하고 다음으로 넘어간다 — 전체 실행을 중단하지 않는다.
3. **규칙 파서**: 5블록을 각각 파싱한다(코드는 `scripts/extract_profile.py`, 함수별로
   위 매핑표와 1:1 대응). 원문에 값이 없으면(공란 `-`) status를 확인불가로 남기고 amount
   는 NULL로 둔다 — 지어내지 않는다.
4. **게이트** (통과 못 하면 해당 행만 적재 중단·보고, 나머지는 정상 진행):
   - **산술 대조**: 부문별 매출 합(segment_revenue, item_name='합계') vs
     `fin_periods.revenue`(같은 period_key, CFS 우선·OFS 폴백) ±1% 이내.
   - **R&D 비중 재계산 대조**: 세전총계÷DB매출×100 이 필자게재 비율과 ±0.5pt 이내.
   - **비율 범위**: `market_share`·`shareholding_pct`·`rnd_revenue_ratio`·
     `segment_revenue_pct`·`segment_total_assets_pct` 는 [0,100] 이어야 한다. **주의**:
     `segment_operating_income_pct` 는 이 게이트에서 **의도적으로 제외**돼 있다 — 한
     부문이 적자면 다른 부문의 영업이익 비중이 100%를 넘거나 음수가 될 수 있다(실측:
     삼성전자 2023년 DX 부문 219.0%, DS 부문 △226.6% — 둘 다 원문 그대로의 정상 값이다).
     여기에 [0,100] 게이트를 걸면 진짜 사실을 오탐으로 확인불가 처리하게 된다 — 새
     concept 을 이 게이트에 추가하기 전에 그 개념이 실제로 [0,100] 불변식을 만족하는지
     먼저 확인한다.
   - **자릿수 sanity**: 같은 concept·item_name 의 연속 기간 값이 **절대값 기준** 10배
     이상 튀면 보류한다(부호만 다른 흑자↔적자 전환은 정상 변동이라 절대값 비율을 쓴다 —
     부호 있는 비율을 쓰면 모든 흑자→적자·적자→흑자 전환이 항상 오탐으로 걸린다).
5. **적재**: 스코프 교체 — (`corp_code` × `concept` × `source_rcept_no`) 단위로
   delete→insert. `ALL_CONCEPTS` 전체를 매번 훑어, 이번 파싱에서 안 나온 concept 은 빈
   리스트로 스코프를 비운다(파서가 고쳐져서 이전엔 나왔던 사실이 이번엔 안 나오는 경우
   스테일 행을 남기지 않기 위해). `corp_history`는 (`corp_code` × `source_rcept_no`) 단위.
   PostgREST 쓰기는 `platform/ingest/ingest.py`의 `rest()`/`upsert()`/`replace_scope()`/
   `storage_download()`를 그대로 재사용한다(재발명 금지).
6. **커버리지 보고**: 콘솔에 concept별 적재/확인불가/게이트보류 건수 + 게이트 통과·실패
   로그를 찍는다(`print_coverage`). 이 출력이 곧 "무엇이 다 들어갔는가"의 실행 증거다.

## 사용법

```bash
cd /Users/titanism/projects/holiday-investment
export NEXT_PUBLIC_SUPABASE_URL=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL' apps/web/.env.local | cut -d= -f2- | tr -d '"'"'"' ')
export SUPABASE_SERVICE_KEY=$(grep -E '^SUPABASE_SERVICE_KEY' apps/web/.env.local | cut -d= -f2- | tr -d '"'"'"' ')
export SUPABASE_REST_URL="$NEXT_PUBLIC_SUPABASE_URL/rest/v1"

# 추출 + 게이트 + 적재 (회사별 여러 rcept 을 한 번에)
python3 plugin/skills/company-profile-extract/scripts/extract_profile.py extract \
    --corps 00126380 --rcepts 20260310002820,20250311001085

# --rcepts 생략 시 회사별 최신 사업보고서 1건 자동 선택
python3 plugin/skills/company-profile-extract/scripts/extract_profile.py extract --corps 00126380

# 적재 없이 파싱+게이트만 재실행(dry-run) — 파서를 고친 뒤 회귀 확인에 쓴다
python3 plugin/skills/company-profile-extract/scripts/extract_profile.py verify \
    --corps 00126380 --rcepts 20260310002820,20250311001085
```

`ingest.py`와 같은 대상 해석 규칙을 따른다: `SUPABASE_REST_URL`/`SUPABASE_SERVICE_KEY`
환경변수 > 레포 루트 `.env.local` > 로컬 기본값. 명령 시작 시 `대상: <host>`를 출력한다 —
호스트를 확인하지 않고 실행하지 않는다.

## 회귀 확인 (파서를 고쳤을 때 반드시 한다)

이 스킬의 존재 이유가 "이번 보고서에서 통과한 파서가 다음 회차에도 통과한다"를 보장하는
것이다. `RD_LABEL_RULES`·`SEGMENT_SUMMARY_WHITELIST`·정규식 매칭 등 파서 로직을 고쳤으면:

```bash
python3 plugin/skills/company-profile-extract/scripts/extract_profile.py verify \
    --corps 00126380 --rcepts 20260310002820,20250311001085
```

두 보고서 모두 게이트 통과·확인불가 건수가 이전과 같거나(더 많이 뽑혔으면 개선) 설명
가능한 차이만 있는지 확인한 뒤에만 `extract`로 실제 적재한다. 한 회차만 보고 고치면
다른 회차가 조용히 깨질 수 있다(파일럿이 실측한 바로 그 실패 모드).

## LLM 폴백 (`--llm-fallback`, 2026-08-25 추가)

2026-08-25 3사 재현시험(`references/재현성-시험-3사.md`)이 "개념 축 자체가 회사마다
다르다"로 확정한 세 블록 — **연혁(`corp_history`) · 부문별 매출 절대금액
(`segment_revenue`) · 시장점유율(`market_share`)** — 만, 규칙 파서가 0행으로 남겼을 때
Claude API(`claude-sonnet-5`)로 보충한다(`scripts/llm_fallback.py`). 주주현황·R&D·
`segment_revenue_pct`/`segment_operating_income`/`segment_total_assets`(★화이트리스트
표)는 이 폴백 범위 밖이다 — 규칙이 통과하는 블록을 LLM으로 대체하지 않는다.

```bash
# 프롬프트만 확인(호출 없음) — 새 회사에 붙이기 전 항상 먼저 이걸로 절단·프롬프트를 본다
python3 plugin/skills/company-profile-extract/scripts/extract_profile.py verify \
    --corps 00126380 --llm-fallback --dry-run --llm-dump-dir /path/to/dump

# 실제 호출(ANTHROPIC_API_KEY 필요 — 없으면 즉시 에러 종료, 조용히 건너뛰지 않는다)
python3 plugin/skills/company-profile-extract/scripts/extract_profile.py extract \
    --corps 00126380 --llm-fallback
```

핵심 설계: LLM은 원문 표기(`raw_amount`·`unit_label`)만 옮기고, 단위 환산·기간 라벨→
연도 매핑은 규칙 파서의 `num()`/`parse_period_col()`/`infer_period_labels()`를 그대로
재사용해 결정론적으로 계산한다(LLM이 계산하지 않는다). `extracted_by='llm:claude-sonnet-5'`
로 규칙 산출물과 구분되고, 같은 `apply_gates()`(부문합 ±1%·[0,100] 범위·자릿수 sanity)를
그대로 통과해야 적재된다. 원문에 관련 키워드가 0건이면(예: 시장점유율 개념이 아예 없는
건설사) API 호출 자체를 생략하고 확인불가로 남긴다(비용 절약, 결과는 동일).

## 알려진 한계 (지어내지 않고 명시)

- **`SEGMENT_SUMMARY_WHITELIST`에 없는 회사**는 부문별 비중/영업이익/총자산이 전부
  확인불가다(위 LLM 폴백 범위 밖 — 절대 매출액과 달리 이 표는 2단 헤더+rowspan이 겹쳐
  회사별 화이트리스트 없이는 규칙도 LLM도 안전하게 못 푼다고 판단해 손대지 않았다).
- **임원 지분·5%이상 합계**: 사업보고서 본문에 원천 데이터가 없다(추정: 임원ㆍ주요주주
  소유상황보고서라는 별도 `report_nm` 계열 공시가 원천). 이 스킬은 Storage의 사업보고서
  섹션만 읽으므로 다룰 수 없다 — DART API 호출도 금지돼 있어(이번 단계 규율) 이 공시
  유형 자체가 스코프 밖이다.
- **Roman 숫자 라벨(Ⅳ·Ⅴ·Ⅶ 등) 문자열 매칭은 정확 일치 기반**이라, 다른 회사가 다른
  유니코드 문자나 "IV"(라틴 문자)로 같은 항목을 표기하면 매칭이 깨진다 — 새 회사에서
  자사주·발행주식수 확인불가가 나오면 먼저 이 문자 인코딩 차이를 의심한다.
- **부문별 매출 표(`부 문/매출유형/품 목` 헤더) 구조가 다른 회사**는 `parse_segment_revenue`
  가 매치하지 않아 `segment_revenue` 전체가 조용히 빈 리스트가 된다(에러가 아니라 콘솔의
  concept별 카운트가 0으로 보고된다 — 실행 후 커버리지 보고를 반드시 확인한다). 2026-08-25
  3사 재현시험 실측: 금융업(2단 헤더 피벗, "매출"이 아니라 "영업수익")·제조업(4단 계층
  부문>제품>품목>매출유형)·건설업(공사종류×국내/해외 축) 이 서로 다른 3가지 분류축을
  쓴다 — `SEGMENT_SUMMARY_WHITELIST`처럼 회사별 화이트리스트를 계속 등록하는 방식은
  한계가 있고, 이 지점이 LLM 폴백의 명시적 1순위 후보다(연혁 블록도 동일 — 헤더가
  `연도`/`일자`/`주요변동사항`으로 회사마다 다르고 표가 아예 없는 회사도 있다).
- **자기주식(Ⅳ/Ⅴ/Ⅶ) '합계' 열 위치는 우선주 발행 여부로 회사마다 다르다.** 원표는
  '구분|주식의종류(보통주/우선주/합계)|비고' 2단 헤더인데 markdown 변환에서 rowspan이
  풀리며 하위 서브헤더가 표의 첫 데이터 행처럼 보인다 — `parse_treasury`는 이제 그
  서브헤더에서 '합계' 위치를 직접 찾는다(`treasury_total_col`, 열 인덱스 고정 금지).
  우선주가 있으면 3번째 칸(부국증권·삼성전자), 없으면 2번째 칸(동신건설)이다. 자기주식수가
  공란("-")이면(삼양식품 2025 사업보고서 실측) `자사주_정밀계산`을 계산하지 않고 확인불가로
  남긴다 — 예전엔 `None`으로 나눗셈을 시도해 `TypeError`가 났고, `run()`이 그 예외를 잡지
  않아 **배치에 묶인 다른 회사까지 통째로 중단**됐다(동신건설이 시도조차 안 됨, 2026-08-25
  실측). 지금은 ① `parse_treasury` 자체가 결측을 확인불가로 다루고 ② `run()`이 회사·회차
  단위로 예외를 격리해 한 곳이 죽어도 나머지가 진행되며, 실패는 콘솔에 어느 회사·회차·
  무슨 예외인지 그대로 남긴다(무인 배치 전제 — 트레이스백을 삼키지 않는다).

## 파일

| 파일 | 내용 |
|---|---|
| `scripts/extract_profile.py` | 파서 5개 + 게이트 4종 + 적재(`extract`) + 검증만(`verify`) |

스크립트는 순수 표준 라이브러리 + 레포 내 `platform/ingest/ingest.py`(PostgREST/Storage
헬퍼)만 쓴다 — 별도 pip 설치 불필요.
