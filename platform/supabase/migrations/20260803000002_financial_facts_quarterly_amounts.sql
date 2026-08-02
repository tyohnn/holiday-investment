-- 분기보고서 금액 유실 — DART 가 보낸 전기동분기·누적 금액을 받는 컬럼 3개 추가.
--
-- ─────────────────────────────────────────────── 무슨 일이 있었나
--
-- ingest 의 load_financials 는 finstate_all 응답에서 금액 필드를 딱 셋만 읽는다:
-- thstrm_amount(당기) / frmtrm_amount(전기) / bfefrmtrm_amount(전전기). 연간
-- 사업보고서(11011)에서는 이게 맞다. 분기·반기 보고서에서는 틀리다.
--
-- raw 표본 6,000파일 1,029,884행 실측 (data/raw/<corp>/fin_<year>_<reprt>.json):
--
--   필드 유효값률(%)          11011   11012   11013   11014
--   thstrm_amount              93.6    95.6    95.6    95.5
--   frmtrm_amount              93.3    34.1    36.8    33.4   ← 분기에서 급락
--   bfefrmtrm_amount           92.9    10.0    16.8     9.1
--   frmtrm_q_amount             0.0    68.8    68.1    68.8   ← 읽지 않던 필드
--   thstrm_add_amount           0.0    16.8    16.8    16.0   ← 읽지 않던 필드
--   frmtrm_add_amount           0.0    16.8    16.8    16.0   ← 읽지 않던 필드
--
-- sj_div 로 갈라보면 왜 이런 모양인지가 한눈에 보인다(11013 기준, 유효값률 %):
--
--                              BS      IS     CIS      CF     SCE
--   frmtrm_amount            98.8     9.3     8.3     9.1    19.5
--   frmtrm_q_amount           0.0    99.6    98.4    92.5    92.9
--   thstrm_add_amount         0.0    98.5    98.2     0.0     0.0
--   frmtrm_add_amount         0.0    99.6    98.4     0.0     0.0
--
-- 스톡(재무상태표 BS)은 분기에도 직전 "기말"과 비교하므로 frmtrm_amount 가 온다.
-- 플로우(IS·CIS·CF·SCE)는 전기 연간이 아니라 **전기 동분기**와 비교하는 게 회계적으로
-- 옳고, DART 도 그 값을 frmtrm_q_amount 로 따로 보낸다. 손익계산서·포괄손익계산서는
-- 여기에 더해 **누적(YTD)** 도 thstrm_add_amount / frmtrm_add_amount 로 보낸다.
-- ingest 는 이 셋을 통째로 버렸다. 그래서 분기 플로우 행의 비교값이 90% 가까이
-- 조용히 NULL 이 되고("DART 가 안 준 것"이 아니라 "받고 버린 것"), 분기 누적 분석은
-- 아예 불가능했다.
--
-- ─────────────────────────────────────────────── 왜 amount_prev 에 안 넣나
--
-- frmtrm_q_amount 를 amount_prev 에 흘려넣으면 한 컬럼에 의미가 둘이 된다 —
-- 연간 행에서는 전기(annual), 분기 행에서는 전기동분기. 그러면 이 컬럼을 읽는 모든
-- 코드가 reprt_code 로 분기해야 뜻을 안다. 게다가 실측상 그 둘은 같은 행에 동시에
-- 오기도 한다(분기 행의 7~9%). 그 동시존재 11,528행 중 64.3% 는 두 값이 아예 같고
-- (frmtrm_nm='제 35 기', frmtrm_q_nm='제 35 기 1분기' 인데 금액은 동일 — DART 가
-- 연간 라벨에 분기 금액을 담아 보낸 경우다) 나머지 35.7% 는 서로 다르다. 덮어쓰기든
-- 폴백이든 어느 쪽을 택해도 일부 행에서 값이 조용히 바뀐다. 컬럼을 나누면 그 선택
-- 자체가 사라진다. amount / amount_prev / amount_prev2 의 매핑은 손대지 않는다.
--
-- ─────────────────────────────────────────────── 왜 frmtrm_q_nm 은 저장하지 않나
--
-- frmtrm_q_nm 은 '제 55 기 3분기' 같은 라벨이고 분기 행의 73% 에 온다. 저장하지 않는다:
-- 표본 111,471행 전수에서 thstrm_nm 의 기수 -1 + 같은 분기표기로 100.00% 유도된다
-- (유도 실패 0건). 즉 새 정보가 0이다. 반면 비용은 0이 아니다 — 아래 자연키가
-- "id 를 뺀 전 컬럼"이므로 컬럼을 하나 늘리면 그대로 인덱스가 커지는데, 이미 이
-- 인덱스 하나가 이 테이블 인덱스 용량의 76% 다. 라벨이 필요한 화면은 (bsns_year,
-- reprt_code) 에서 만들면 된다. 기수(제 N 기)가 정말 필요해지면 그때 thstrm_nm 을
-- 별도 컬럼으로 받는 편이 낫다 — 파생 라벨이 아니라 원천 값이므로.
--
-- ─────────────────────────────────────────────── 자연키 재생성이 안전한 이유
--
-- ff_natural_key(20260803000001)는 id 를 뺀 전 컬럼 유니크 + nulls not distinct 이고,
-- ingest.py 의 FIN_KEY 튜플과 컬럼·순서가 같아야 한다(PostgREST on_conflict 가 이
-- 목록으로 인덱스를 추론한다). 컬럼이 늘면 둘을 같이 고쳐야 한다.
--
-- 방향이 안전한 쪽이다. 키에 컬럼을 더하면 인덱스는 **더 느슨해진다**. 기존 두 행
-- a,b 가 새 키에서 충돌하려면 옛 키 컬럼이 전부 같아야 하는데, 그건 옛 유니크
-- 인덱스가 이미 금지하고 있다. 새 컬럼 셋은 기존 행에서 전부 NULL 이고 nulls not
-- distinct 가 NULL 을 값처럼 비교하므로 모든 쌍에 "같은 성분" 셋을 더할 뿐 —
-- 충돌을 새로 만들어낼 수 없다. 따라서 이 재생성은 기존 데이터에서 실패할 수 없다.
--
-- create index concurrently 는 쓸 수 있는데도 쓰지 않는다. 처음엔 "트랜잭션 안에서
-- 못 도니까 애초에 불가"라고 적으려 했는데, 실측해보니 틀렸다 — supabase CLI
-- v2.194.0 은 파일에 concurrently 가 있으면 트랜잭션 래핑을 스스로 건너뛴다.
-- 스크래치 DB 에 넣어본 결과다(같은 파일에 create table + concurrently + 실패하는
-- 문장을 넣었더니 앞의 create table 이 살아남았다 = 롤백 없음. concurrently 를 뺀
-- 파일에서는 같은 실험이 롤백됐다 = 래핑됨). 그러니 선택은 가능/불가가 아니라 트레이드오프다.
--
--   * 지금 방식(트랜잭션 안 drop+create): 빌드 동안 financial_facts 가 ACCESS
--     EXCLUSIVE 로 잠긴다. 대신 원자적이다 — 끝까지 되거나 통째로 없던 일이 되고,
--     유니크 가드가 비는 순간이 0이다.
--   * concurrently: 쓰기를 안 막는 대신, (a) 이 파일 전체가 비트랜잭션이 되어
--     위의 alter table 까지 실패 시 롤백되지 않는다, (b) 새 인덱스를 먼저 만들고
--     옛 인덱스를 지우고 rename 하는 3단계가 되는데 중간에 죽으면 INVALID 인덱스가
--     남아 사람 손으로 치워야 한다 — 마이그레이션이 반쯤 적용된 상태를 남긴다.
--
-- 지금은 백필을 세우고 도는 유지보수 작업이라 쓰기를 막는 비용이 사실상 0이고,
-- "반쯤 적용된 스키마가 남지 않는다"가 그보다 비싸다. 그래서 잠그고 한 번에 간다.

alter table financial_facts
  add column if not exists amount_prev_q   numeric,
  add column if not exists amount_cum      numeric,
  add column if not exists amount_prev_cum numeric;

comment on column financial_facts.amount_prev_q is
  '전기 동분기 (DART frmtrm_q_amount) — 분기·반기 보고서의 플로우(IS·CIS·CF·SCE) 비교값. '
  '재무상태표(BS)와 연간 보고서에는 오지 않는다(그쪽은 amount_prev).';
comment on column financial_facts.amount_cum is
  '당기 누적/YTD (DART thstrm_add_amount) — 분기·반기 보고서의 IS·CIS 에만 온다.';
comment on column financial_facts.amount_prev_cum is
  '전기 누적/YTD (DART frmtrm_add_amount) — 분기·반기 보고서의 IS·CIS 에만 온다.';

-- 자연키 재생성 — 컬럼 목록·순서는 ingest.py 의 FIN_KEY 와 글자 그대로 같아야 한다.
-- 새 금액 셋은 amount_prev2 뒤, currency 앞에 넣는다(금액끼리 붙여둔다).
drop index if exists ff_natural_key;
create unique index if not exists ff_natural_key
  on financial_facts (corp_code, bsns_year, reprt_code, fs_div, sj_div,
                      account_id, account_nm, account_detail, ord,
                      amount, amount_prev, amount_prev2,
                      amount_prev_q, amount_cum, amount_prev_cum,
                      currency, rcept_no)
  nulls not distinct;

-- 이미 적재된 행은 새 컬럼이 전부 NULL 이다. 이 마이그레이션은 백필하지 않는다 —
-- 값은 DART 응답에만 있고, data/raw 에 남은 원본으로 오프라인 재적재하는 것이
-- 별도 과제다(915개사 account_detail 재적재와 같은 작업으로 묶으면 한 번에 끝난다).
-- 그때까지 amount_prev_q·amount_cum·amount_prev_cum 은 신규 적재분에만 채워진다.

-- 권한 주의(20260802000005 / 20260802000006 의 그 발판): 여기서도 새 테이블·시퀀스를
-- 만들지 않는다 — 기존 테이블의 컬럼과 인덱스뿐이다. 컬럼 추가는 테이블 권한을
-- 상속하므로 financial_facts 의 권한(anon·authenticated 0, service_role 만)이 그대로
-- 유지된다. 새로 열리는 표면은 없다.
