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

## 적재 실측 (2026-07-25, 2종목)

| | 크래프톤 | 에코프로비엠 |
|---|---|---|
| filings (전 역사) | 567건 (정정 77) | 859건 (정정 76) |
| financial_facts (2015~, 분기 포함) | 4,398행 | 4,888행 |
| report_items / events / ownership | 1,704 / 16 / 62 | 775 / 13 / 94 |
| 소요 | 0.9분 | 0.9분 |

교차검증: annual_summary의 매출·영업이익이 스킬 재무추이 md 및 교재 수치와 일치
(에코프로비엠 2020 매출 8,547억, 2024 영업이익 -341억 등).

## 다음 (A1 잔여 → A2·A3)

- [ ] 정정 체인(corrects_rcept_no) 채우기 — 같은 보고서명·기간의 원본↔정정 연결
- [ ] trackings 원장 실험 — A2에서 md 방식과 비교 판정 (로드맵 유보 사항 ⑵)
- [ ] A3: 종목 1페이지 프로토타입 (annual_summary·filings·events·trackings 뷰 소비)
