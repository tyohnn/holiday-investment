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

## 실행

```bash
# 전제: Docker 실행, supabase CLI (~/.local/share/supabase — PATH 필요), DART_API_KEY(.env.local)
export PATH="$HOME/.local/share/supabase:$PATH"
cd platform
supabase start          # 로컬 스택 (REST :54321, DB :54322, Studio :54323)
supabase migration up   # 스키마 적용 (전체 리셋은 supabase db reset — 데이터 삭제됨)

python3 ingest/ingest.py 크래프톤            # 전 역사 적재 (~1분/종목, 멱등)
python3 ingest/ingest.py 에코프로비엠
python3 ingest/ingest.py 크래프톤 --only fin  # 일부 단계만
```

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

## 다음 (A2·A3)

- [ ] A2: 2회차 갱신 사이클 + trackings 원장 vs md 판정 (완료 기준 ③)
- [ ] A3: zod 스키마+한글 라벨 사전 (`platform/schema/`) → 종목 1페이지 프로토타입
      (annual_summary·filings·filing_correction_chains·events·sections 소비)
