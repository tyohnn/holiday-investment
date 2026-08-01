# platform — P-A 파일럿 (정형 데이터 플랫폼)

로드맵 "플랫폼 실행 계획"의 P-A. **여기의 모든 스키마·구조는 가설이며, 시행착오가 곧
산출물이다** (로드맵 "P-A 설계 유보 사항"). 깎은 기록은 아래 시행착오 로그에 남긴다.

## 구성

```
platform/
├── supabase/            # 로컬 스택 설정 + migrations/ (스키마 버전 관리)
├── ingest/ingest.py     # OpenDART → Postgres 적재 (stdlib, PostgREST 사용)
└── data/raw/            # API 원본 JSON (gitignore — 재적재·디버깅용)
```

## 실행 — 데이터 덤프에서 즉시 복원 (권장, 어떤 환경에서든)

DART 재수집(종목당 3~5분) 없이, 커밋된 덤프로 지금 상태를 그대로 재현한다.

```bash
export PATH="$HOME/.local/share/supabase:$PATH"
cd platform
supabase start    # 로컬 스택 (REST :54321, DB :54322, Studio :54323)
                   # → 마이그레이션 적용 + supabase/seed.sql 자동 로드 (companies·filings·
                   #   financial_facts·report_items·events·registrations·ownership_txns·
                   #   trackings·filing_docs 메타 — 3.7MB)

# filing_sections(사업보고서 원문·주석, 3,052행)는 크기 때문에 별도 압축 파일 — 수동 1회
gunzip -c supabase/seed-filing-sections.sql.gz | \
  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

이미 떠 있는 스택에 최신 시드를 다시 앉히려면 `supabase db reset`(마이그레이션 재적용 +
`seed.sql` 자동 재로드 — **로컬 DB의 기존 데이터를 지운다**) 후 위 `gunzip` 한 줄만 다시 실행.

## 처음부터 DART 재수집 (덤프 없이, 또는 새 종목 추가 시)

```bash
# 전제: Docker 실행, supabase CLI (~/.local/share/supabase — PATH 필요), DART_API_KEY(.env.local)
export PATH="$HOME/.local/share/supabase:$PATH"
cd platform
supabase start
supabase migration up

python3 ingest/ingest.py 크래프톤            # 전 역사 적재 (원문 포함 3~5분/종목, 멱등)
python3 ingest/ingest.py 에코프로비엠
python3 ingest/ingest.py 크래프톤 --only fin  # 일부 단계만
```

## 덤프 갱신 (데이터 추가·변경 후 커밋 전)

```bash
cd platform
rm -f supabase/seed.sql
supabase db dump --local --data-only --schema public \
  -x public.account_concepts -x public.filing_sections -f supabase/seed.sql
supabase db dump --local --data-only --schema public \
  -x public.companies -x public.filings -x public.financial_facts \
  -x public.report_items -x public.events -x public.registrations \
  -x public.ownership_txns -x public.trackings -x public.filing_docs \
  -x public.account_concepts -x public.analyses \
  --use-copy -f /tmp/sections-only.sql
gzip -9 -c /tmp/sections-only.sql > supabase/seed-filing-sections.sql.gz
```

`account_concepts`는 마이그레이션 0002에서 이미 INSERT로 시드되므로 데이터 덤프에서 항상
제외한다(포함하면 PK 충돌). `filing_sections`만 분리하는 이유는 크기다 — 전체 51MB 중
51MB가 이 테이블 하나(원문 텍스트, 섹션당 최대 26만 자)이고 나머지 9개 테이블 전부 합쳐도
3MB 남짓이다. **`--use-copy`는 `supabase/seed.sql`(자동 로드분)에는 쓰지 않는다** — CLI의
시드 로더가 COPY 블록을 파싱 못 해 깨진다(직접 겪은 실패: `db reset` 도중 seed 적용
실패 → 스키마만 재생성된 빈 DB로 남음). COPY는 `psql -f`로 수동 복원하는
`seed-filing-sections.sql.gz` 쪽에서만 안전하다.

**갱신 후 검증 없이 커밋하지 않는다** — 마이그레이션 전체 + 두 시드를 별도 임시 DB
(`CREATE DATABASE verify_seed`)에 처음부터 적용해 원본과 행 수가 일치하는지 확인하고
버린다. 운영 중인 로컬 DB에서 직접 `db reset`으로 검증하다 시드가 깨지면 데이터가
날아간다(실제로 한 번 날렸고, DART 재수집 + 트래킹 md 재이행으로 복구했다).

## 설계 결정 (v0 가설)

- **DB 쓰기는 PostgREST** — 드라이버 의존성 0(stdlib), UI가 쓸 API 표면을 ingest가 먼저 검증.
- **멱등성**: companies/filings는 PK upsert, 나머지는 스코프 교체(delete→insert).
  같은 명령을 몇 번 돌려도 행 수가 같다(검증 완료).
- **컬럼 vs jsonb**: 쿼리 축(날짜·종류·연도)만 컬럼, 롱테일 필드는 payload(jsonb) —
  원본을 잃지 않으므로 재수집 없이 컬럼 승격 가능.
- **정규화는 뷰로**: 원본 테이블(financial_facts)은 API 응답 그대로, 표준화는
  `account_concepts` + `financial_metrics`/`annual_summary` 뷰가 담당. 개념 추가 =
  concepts 행 추가.
- 수집 로직은 플러그인 `dart_api.py`를 그대로 import — 수집 코드 단일 소스.

## 시행착오 로그 (모델을 깎은 기록)

| # | 발견 | 대응 |
|---|---|---|
| 1 | 회사마다 손익 최상단 계정명이 다르다 — 크래프톤 `영업수익`(CIS) vs 에코프로비엠 `매출액`(IS). 계정명 조인은 종목마다 깨진다 | XBRL `account_id`(`ifrs-full_Revenue`)가 변형을 흡수함을 확인 → 정규화 축을 account_id로 (마이그레이션 0002) |
| 2 | XBRL 미적용 계정의 account_id는 null이 아니라 문자열 센티널 `-표준계정코드 미사용-` (크래프톤 2022 실측) | 센티널을 결측 취급하고 계정명 폴백 적용 (0003) |
| 3 | 신형 supabase CLI는 마이그레이션 생성 테이블에 기본 role 권한을 안 붙인다 (service_role 403) | 마이그레이션이 GRANT를 직접 보장 (0001) |
| 4 | PostgREST 필터에 한글 값(`item=eq.배당`)은 percent-encoding 필수 | urlencode 적용 |
| 5 | `company.json`은 `list` 없이 최상위 필드 응답 — 페이지네이션 수정 때 플러그인 `company()`가 빈 값을 반환하게 됐었음 | dart_api.company raw 모드 수정 |
| 6 | vector(analytics) 컨테이너 unhealthy로 `supabase start` 실패 | config.toml `[analytics] enabled=false` |
| 7 | **XBRL 택소노미에 세대가 있다** — 구버전 `ifrs_Revenue`(하이픈 없음) vs 신버전 `ifrs-full_Revenue` (에코프로비엠 초기 연도 실측). account_id 도메인은 회사(커스텀 태그)뿐 아니라 시간(택소노미 버전)으로도 열린 집합 → **DB enum 부적합**, 개념 테이블+별칭 배열로 | account_concepts.account_id_alts (0005) — 에코프로비엠 2018(매출 5,892억) 복구 확인 |
| 8 | 한국어 tsvector는 형태소 분석기 없이 품질이 낮고 1MB 제한이 있다 | 파일럿 검색은 pg_trgm GIN + ILIKE (0004) — '지급보증' 주석 240건 검색 실증 |
| 9 | 공시 중 일부(기업설명회 개최 등)는 원문 문서가 없다 (document.xml 실패) | filing_docs.status에 error 기록하고 계속 — 실패 32/1,426건 |

## 적재 실측 (2026-07-25, 2종목 — A1 확장 후)

| | 합계 (크래프톤 + 에코프로비엠) |
|---|---|
| filings (전 역사) | 1,426건 (기재정정 153) |
| **filing_docs (원문 전량)** | 1,426건 시도 · 1,394 성공 (파일은 data/raw/*/docs/) |
| **filing_sections (목차 섹션)** | 3,052행 — 주석★ 265 · 사업의내용☆ 114, pg_trgm 전문검색 |
| financial_facts (2015~, 분기 포함) | 9,286행 (전 계정, 원 단위) |
| report_items (24항목) | 3,033행 — 회사채 잔액·자금 사용내역·감사계약 등 확장분 포함 |
| events (36종) | 37건 — 확장으로 회사합병 3·**회사분할 1(에코프로 물적분할)**·타법인주식양수 1 등 신규 포착 |
| registrations (증권신고서 6종) | 80행 |
| ownership_txns | 156건 |
| 원문 포함 전체 적재 소요 | 종목당 3~5분 |

교차검증: annual_summary가 스킬 재무추이 md·교재 수치와 일치 (에코프로비엠 2020 매출
8,547억·2024 영업이익 -341억, 크래프톤 2022 매출 18,540억 등).

## A1 완료 기준 결산 (2026-07-25)

| 기준 | 상태 |
|---|---|
| ① 두 종목 전 역사 멱등 재적재 | ✅ 재실행 시 행 수 동일 검증 |
| ② 기재정정 DB 표현·조회 | ✅ is_correction + `filing_correction_chains` 뷰 — 153건 중 150건 자동 연결, E2E에서 수동 대조했던 사업보고서 체인(60일 시차)을 자동 재현 |
| ③ 트래킹 사실 정본 형태 | → **A2에서 판정** (trackings 테이블 준비됨, 로드맵 유보 사항 ⑵) |
| ④ 종목 페이지 DB 렌더 | → **A3** |
| ⑤ 수집 단가·시간 실측 | ✅ 원문 포함 종목당 3~5분, 종목당 API 콜 ~700 |

정정 체인 설계 노트: 원본↔정정 관계는 보고서명(프리픽스 제거)이 같은 직전 공시로
결정론적으로 유도되므로 **저장하지 않고 뷰로 파생**한다. 미연결 3건은 원본이 수집 범위
밖이거나 제목 매칭이 안 되는 소수 케이스 — null로 남겨 조회 가능.

## A2 완료 (2026-07-25) — 트래킹 정본은 DB 원장

같은 갱신 과제를 두 서브에이전트(sonnet)에게 **md 편집 / CLI 원장**으로 각각 시켜 판정
기준 5개로 비교했고, **B안(DB 원장 정본 + md는 생성 뷰)** 을 채택했다. 상세 비교표는
[A2 실험 결과](https://app.notion.com/p/3af346dac45681fba445d73e79a4bddf)에 있다.

- 마찰: 도구 호출 9회(원장) vs 20회(md) · 토큰 102k vs 111k · 3.6분 vs 5.2분
- 결정타는 **md의 조용한 실패**: 월 단위 날짜 1행 파싱 소실, 문서 내 자기모순 발생 직전,
  같은 공시의 이중 기록(접수일 vs 합병기일)
- 도구: `ingest/tracking.py` (add·list·export-md·import-md). append-only, update/delete 없음
- 2회차 갱신 사이클 검증: 신규 적재 이벤트 5건 + 증권신고서를 원장에 반영 → 2017~2018년
  사실이 기존 시계열 **중간에 자동 정렬 삽입**되어 크래프톤 M&A 연대기가 완성됨

시행착오 로그 추가분:

| # | 발견 | 대응 |
|---|---|---|
| 10 | 에이전트는 날짜를 `2025-09`·`2022`·`2026 1Q`로 자연스럽게 쓴다. md 파서는 조용히 누락, date 타입은 거부 — 둘 다 틀림 | `date_precision`(day/month/quarter/year) 컬럼 + CLI 정규화, md 뷰에서 원표기 복원 (0007) |
| 11 | 중복 키가 (주제·날짜·문장)이면 같은 공시를 다른 날짜 기준으로 쓴 중복을 놓친다 (실제 발생) | `(주제, 접수번호)` 1순위 키 (0007) |
| 12 | 같은 사실이 두 주제에 걸침 (IPO 자금사용목적 = 자금조달 ∩ M&A) | primary topic + `tags` 배열 (0007) |

## A3 완료 (2026-07-25) — 데이터 계약 + 종목 1페이지

- **`packages/schema`** (`@investment/schema`) — 플랫폼 데이터 계약.
  - `labels.ts`: **DART 원본 필드명 → 한글 라벨 사전**. 원본 키를 개명하지 않으므로 개발가이드와
    1:1 대조가 되고 번역 버그가 존재할 수 없다. UI는 라벨을 보여주고 원본 키는 `title` 속성으로
    병기한다. 업종코드(KSIC) 사전도 포함.
  - `index.ts`: zod 계약. events는 단일 테이블 + `event_type` 판별자 + passthrough payload
    (strict는 전 상장사에서 반드시 깨진다). **검증은 쓰기가 아니라 읽기 경계**에서 — ingest는
    원본 보존, UI가 해석. `FinancialConcept` enum이 UI의 닫힌 축(account_id는 열린 집합).
  - 포매터: `formatWon`(원→조/억), `formatFactDate`(정밀도별 원표기 복원) 등. DB는 원 단위 원본.
- **`apps/web/lib/platform/db.ts`** — `getCompanyPageData(stockCode)` 하나로 페이지 데이터 병렬 fetch.
- **`/company/[stockCode]`** — 헤더·재무차트(recharts 이중축)·핵심지표·사실시계열·공시타임라인·
  정정체인·주요사항 이벤트. Server Component + 차트만 client.

시행착오 로그 추가분:

| # | 발견 | 대응 |
|---|---|---|
| 13 | `export * from "./labels.js"`(NodeNext 관례) — Turbopack은 확장자 자동 매핑을 안 해 빌드 100% 실패 | 확장자 없는 `"./labels"` 로 근본 수정 (번들러 무관하게 동작) |
| 14 | recharts v3.10 `ComposedChart`+이중축에서 애니메이션 켜면 막대가 렌더되지 않음(DOM에 rect 없음) | 전 시리즈 `isAnimationActive={false}` — 차트 복제 시 기본값으로 |
| 15 | `induty_code`가 코드만 있어 UI에 "업종코드 28202" 노출 | `SECTOR_NAMES` 사전 + `sectorName()` |
| 16 | 라벨 사전이 실제 payload보다 얕음(회사합병 9/68필드, 신탁계약·유무상증자 유형 자체 누락) | 실제 payload 키를 DB에서 뽑아 사전 보강 — 합병 60여 필드, 신탁 체결·해지, 유무상증자(piic_/fric_ 접두사) 추가 |
| 17 | `supabase db dump --use-copy`로 뜬 `seed.sql`을 `supabase db reset`이 자동 로드하다 COPY 블록 파싱에 실패 — **스키마만 재생성된 채 DB가 비어버림**(운영 중인 로컬 DB에서 직접 겪음, 트래킹 87건 포함 전체 소실) | 자동 로드용 `seed.sql`은 INSERT 형식(비-COPY)으로, 크기 때문에 분리한 `filing_sections`(51MB)만 COPY+gzip으로 별도 파일 유지하고 `psql -f` 수동 복원으로 한정. 검증은 운영 DB가 아니라 임시 DB(`verify_seed`)에서 |

## 다음 (P-A 종료 → P-B)

- [ ] A3 잔여: 트래킹 없는 종목(에코프로비엠) 트래킹 시드, 주석 섹션 뷰어(filing_sections 본문)
- [ ] P-B: 스키마 호스티드 승격 → 전 상장사 백필 → 스크리너
