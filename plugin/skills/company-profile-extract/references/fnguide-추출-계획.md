# FnGuide 기업정보를 기준으로 한 원문 추출 계획

2026-08-23. 삼성전자(005930) 파일럿 → 스킬화 → 전 종목 반복.

## 전제 (이미 완료된 것)

- 삼성 정기보고서 107건의 원문·섹션이 Storage에 있다
  (`docs/00126380/<rcept_no>.zip` + `.sections.json.gz`, 섹션 1,205개)
- 전 종목 Phase 3(원문 업로드)가 진행 중 — 완료되면 어느 회사든 같은 절차 적용 가능
- 섹션은 Postgres에 두지 않는다(확정). 추출된 **사실**만 DB에 넣고 출처 포인터를 남긴다

## 1. FnGuide 기업개요 블록 → 소스 매핑 (전수)

스크린샷 5장의 모든 블록을 빠짐없이 배치한다. ★ = 이번에 새로 만드는 추출.

### 지금 바로 되는 것 (추출 불필요)

| 블록 | 소스 | 비고 |
|---|---|---|
| General Info — 주소·영문명·대표·설립일·홈페이지·전화 | `companies.profile` | |
| General Info — 감사인·감사의견 | `report_items` 감사의견 | 삼성 2025: 삼정/적정 실측 일치 |
| General Info — 종업원수 | `report_items` 직원 | 성별 합계 = 128,881 실측 일치 |
| 비용구성 — 판관비율·매출원가율 | `fin_periods` `sga/revenue`·`cogs/revenue` | FnGuide와 소수 1자리까지 일치 실측 |
| 인원 현황 — 남/여·급여총액·근속·평균급여 | `report_items` 직원 | |
| 관계사 현황 — 지분율 | `report_items` 타법인출자 | |
| 재무비율 페이지 안정성비율 일부 | `fin_periods` | 부채비율·자기자본비율·순부채비율 |

### fin_periods 컬럼 추가로 되는 것 (기존 계획, 추출 불필요)

| 항목 | 필요 컬럼 |
|---|---|
| 유동비율·당좌비율 | 유동자산·유동부채·당좌자산 |
| 유보율 | 자본금·유보액 |
| 이자보상배율 | 이자비용 |
| (결함 수정) Q4·TTM 현금흐름 | 적재 함수 수정 |

### ★ 원문 추출 대상 (이번 파일럿의 본체)

| 블록 | 원문 위치 (섹션) | 형태 | 저장처 |
|---|---|---|---|
| 최근연혁 | `I. 회사의 개요 → 2. 회사의 연혁` | **비수치** (날짜·구분·내용) | `corp_history` |
| 매출비중 추이 (부문별) | `II. 사업의 내용` / 영업부문 주석 | 수치 (부문×기간×%) | `fin_details` |
| 주요제품 시장점유율 | `II. 사업의 내용` (회사가 인용한 벤더 수치) | 수치+출처 | `fin_details` |
| 연구개발비 지출 | `연구개발활동` | 수치 (총액/자산화/비용화/매출비중×연도) | `fin_details` |
| 주주 구분별 지분현황 | `VII. 주주에 관한 사항` | 수치 (구분×시점×%) | `fin_details` |
| 상장일 | 사업보고서 `주권상장여부` (크래프톤 원문에 실재 확인) | 단일값 | `companies` 컬럼 |
| (후속) 판관비 세부 | 손익 주석 | 수치 | `fin_details` |
| (후속) 감가상각비 보강 | 유형자산 주석 | 수치 → `fin_periods.depreciation` 승격 후보 | `fin_details` |

### 넣지 않는 것 (기존 결정 유지)

신용등급(데이터 없음) · 주거래은행 · 벤처지정 · IR 개인전화 · 계열(공정위 자산) ·
배당락일(DART payload에 날짜 필드 없음 — SCR-002 정정 사항).
자본금 변동내역은 `events` 자기주식소각 + `report_items` 증자로 **부분** 재구성 가능 —
파일럿에서 실측 후 판정.

## 2. 저장 스키마 (신규 2테이블)

### `fin_details` — 수치 사실 long 테이블 (파일럿 반영 개정)

```
corp_code        text
period_key       text          -- '2025A' | '2026Q1' | 시점형이면 '2026-08-24'
concept          text          -- 'segment_revenue_pct' | 'rnd_total' | 'market_share' | ...
item_name        text          -- 'DS' | 'DRAM' | '급여' ... (부문·제품·계정 이름)
amount           numeric       -- NULL 허용 ← "확인 불가"를 1급 레코드로 (status 참조)
unit             text          -- 'KRW' | 'pct' | '명' ...
value_basis      text          -- ★파일럿 추가: '세전'|'세후'|'반올림1자리' 등 — 같은 개념의
                               --   변형 기준. R&D 총액에서 FnGuide 자체가 세전/세후를
                               --   섞어 쓰는 것이 실측됐다 (2023만 세후, 나머지 세전)
status           text          -- 'ok' | '확인불가:<사유>' ← 지어내는 대신 기록하는 자리
source_rcept_no  text references filings
source_section   text          -- 섹션 제목
source_table     text          -- ★파일럿 추가: 표 이름까지 — 출처 3단 (rcept·섹션·표).
                               --   한 섹션에 표가 여럿이라 섹션만으로 원문 대조가 안 됐다
extracted_by     text          -- 'rule' | 'llm:<모델>'
extracted_at     timestamptz
```

- 유니크: `(corp_code, period_key, concept, item_name, source_rcept_no)`
- 적재는 스코프 교체 (corp_code × concept × source_rcept_no)
- RLS: 20260802000005 패턴 그대로 (service_role 전용)
- ★파서 회귀 세트: 같은 항목의 표 모양이 **보고서 회차마다 달라지는 것**이 실측됐다
  (R&D '연구개발비(비용)' 행이 2025/2024 보고서에서 다른 구조). 파서 테스트는
  "표 하나"가 아니라 "같은 표의 여러 회차"로 짠다. 병합 셀 붕괴는 패턴이 2가지뿐이라
  일반 규칙으로 해결됨(파일럿 §0) — 2단 헤더+rowspan 표만 표 전용 처리가 필요

### `corp_history` — 연혁 (비수치)

```
corp_code, event_date(년월), category, content,
source_rcept_no, source_section, extracted_by, extracted_at
```

연혁을 `events`(주요사항 보고서)로 대체하지 않는다 — 성격이 다름(SCR-002 결론 유지).

### 웹 노출 규칙

`fin_details`는 **한 회사 상세 화면** 용도다. 회사를 가로지르는 지표로 승격할 것
(예: R&D/매출)만 `fin_periods` 컬럼으로 올린다 — 승격 기준은 파생계층-설계.md 3번.

## 3. 추출 파이프라인

```
Storage .sections.json.gz  (이미 존재)
   ↓
[1] 규칙 기반 파서 먼저 — R&D 표·연혁 표·주주현황 표는 마크다운 표로 이미 구조화됨
   ↓ 실패하거나 서술형인 것만
[2] LLM 추출 — 부문매출 서술, 점유율 인용 문장
   ↓
[3] 검증 게이트 (기계)
   ↓
fin_details / corp_history  (+출처 포인터)
```

### 검증 게이트 — 반드시 통과해야 적재

1. **산술 대조**: 부문별 매출 합 ≈ `fin_periods.revenue` (±1%),
   R&D/매출 비중 재계산 = 추출된 비중, 지분율 합 ≤ 100
2. **자릿수 sanity**: 전례(에코프로머티 8,220억 vs 원문 1,665억)의 재발 방지 —
   전년 대비 10배 이상 튀면 적재 보류·보고
3. **출처 필수**: `source_rcept_no` + `source_section` 없는 행은 거부
4. 실패 항목은 지어내지 않고 "확인 불가"로 보고

### LLM 규칙 (파생계층-설계.md 재확인)

- LLM은 **원문에 있는 숫자를 구조로 옮기는 것만** 한다. 생성·보간 금지
- `extracted_by`로 rule/llm 구분 — 나중에 신뢰도 감사 가능
- 원문이 Storage에 있으므로 재추출은 언제든 DART 호출 0건

## 4. 스킬화

`plugin/skills/company-profile-extract/` (investment-analyst 플러그인 형식)

```
SKILL.md            -- 절차: 대상 섹션 찾기 → 파서 → LLM 폴백 → 게이트 → 적재 → 보고
scripts/
  extract_profile.py   -- 규칙 기반 파서 + 적재 (fin_details/corp_history)
  verify_profile.py    -- 검증 게이트 단독 실행
```

- 입력: corp_code. 출력: 적재 결과 + 블록별 커버리지 보고(FnGuide 블록 기준 체크리스트)
- 스킬 문서에 **FnGuide 블록 → concept 매핑표**(위 1번)를 그대로 싣는다 —
  "무엇이 다 들어갔는가"의 기준이 스킬 안에 있어야 반복 가능
- 삼성 파일럿에서 절차가 확정된 뒤 스킬로 굳힌다 (파일럿 먼저, 스킬은 그 기록)

## 5. 실행 순서

1. **삼성 파일럿**: 최신 사업보고서(20260310002820) 1건으로 연혁·R&D·부문매출·주주현황
   추출 → 게이트 통과 확인 → FnGuide 스크린샷과 수치 대조
2. 마이그레이션: `fin_details` + `corp_history` (잠금 패턴 포함)
3. 삼성 전체 이력(107건 정기보고서)으로 확장 — 시계열 완성
4. 스킬 작성 + 다른 회사 1곳(크래프톤 등)으로 재현성 확인
5. (별도 트랙) fin_periods 6컬럼 + Q4/TTM 현금흐름 수정
6. (별도 트랙) 웹 `/company/[코드]/profile` 화면 — 데이터가 쌓인 뒤

## 미확정

- 시장점유율의 시계열화 여부 (FnGuide는 최신 스냅샷만 — 우리는 보고서마다 있으니 시계열 가능)
- 자본금 변동내역 재구성 가능성 (파일럿 실측 후)
- `fin_details.concept` 어휘를 `account_concepts`와 통합할지 별도 관리할지

## 다음 계획 (파일럿 후, 사용자 확정 2026-08-24)

**`report_items` 파생 계층.** report_items 는 23개 API 응답을 payload JSONB 원본
그대로 담고 있어 가공 계층이 없다 — 화면마다 payload 를 매번 접어야 하고 숫자도
`"37,787"` 문자열이다. `financial_facts → fin_periods` 와 같은 원본→파생 구조를
여기에도 적용한다. FnGuide 기준 우선순위: 인원 현황(직원), 관계사(타법인출자),
배당, 주주(최대주주·소액주주). 파일럿 완료 후 함께 설계.
