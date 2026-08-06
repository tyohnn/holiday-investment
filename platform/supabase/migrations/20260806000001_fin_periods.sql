-- 파생 지표 계층 — account_concepts 확장 + 실체 테이블 fin_periods.
--
-- 설계: HIDM-2 "파생 지표 계층 (fin_periods)".
-- 목적: annual_summary 는 뷰라서 질의할 때마다 financial_facts 1,392만 행을 훑는다.
-- 종목 하나를 볼 때는 괜찮지만 스크리너가 전 종목을 훑으면 감당이 안 된다. 실측:
-- `where bsns_year=2025 and opm_pct>15 and debt_ratio_pct<100` 이 **9,461 ms**
-- (explain analyze, 호스티드, 개념 9개 시점). 게다가 분기·반기가 전체 행의 71%인데
-- 파생이 하나도 없다. 이 마이그레이션이 (corp_code, period_key, fs_div) 단위 wide
-- 실체 테이블을 만들어 그 표면을 소유한다.
--
-- ─────────────────────────────────────────────── 1부. 개념 10개 추가 — 실측 근거
--
-- 이름을 짐작하지 않고 호스티드 financial_facts 를 실제로 세어서 정했다. 모든 수치는
-- reprt_code='11011'(사업보고서) · amount not null 기준이고, 분모는 **연간 재무제표가
-- 하나라도 있는 상장·비상장 2,648개사**다.
--
--   (account_id, account_nm) 별 회사수 상위 실측 — 어떤 태그가 실제로 쓰이는가
--     현금:   ifrs-full_CashAndCashEquivalents/현금및현금성자산            2,610사
--             ifrs_CashAndCashEquivalents/현금및현금성자산                 1,820사  ← 구택소노미
--     판관비: dart_TotalSellingGeneralAdministrativeExpenses/판매비와관리비 2,184사
--     매출원가: ifrs-full_CostOfSales/매출원가                             2,150사
--             ifrs_CostOfSales/매출원가                                    1,565사
--     장기차입금: dart_LongTermBorrowingsGross/장기차입금                  1,850사
--             ifrs-full_LongtermBorrowings/장기차입금                        235사
--     단기차입금: ifrs-full_ShorttermBorrowings/단기차입금                 1,725사
--             ifrs_ShorttermBorrowings/단기차입금                          1,214사
--             dart_ShortTermBorrowings/단기차입금                          1,113사
--             ifrs-full_ShorttermBorrowings/"유동 차입금"                    611사  ← 같은 id, 다른 이름
--     유동성장기차입금: ifrs-full_CurrentPortionOfLongtermBorrowings         881사
--     사채:   dart_BondsIssued/사채                                          312사
--     유동성사채: dart_CurrentPortionOfBonds/유동성사채                      319사
--     감가상각비: dart_AdjustmentsForDepreciationExpense/감가상각비(CF)       761사
--             ifrs-full_AdjustmentsForDepreciationExpense/…                  325사
--             dart_DepreciationExpense/감가상각비(CIS)                       152사
--
--   별칭을 다 합친 **개념 단위 커버리지**(2,648사 대비, 한 해라도 값이 있으면 1)
--     cash                  2,647  100.0%
--     sga                   2,503   94.5%
--     cogs                  2,392   90.3%
--     st_borrowings         2,268   85.6%
--     lt_borrowings         2,100   79.3%
--     current_lt_borrowings 1,486   56.1%
--     depreciation            893   33.7%   ★
--     amortisation            841   31.8%   ★
--     bonds                   493   18.6%   ★
--     current_bonds           417   15.7%   ★
--
-- ★ 표시 넷은 커버리지가 낮다. 조용히 넣지 않고 여기 숫자로 남긴다.
--   - **감가상각비 33.7% 는 매칭 실패가 아니라 원천의 성질이다.** 가장 넓은 그물
--     (sj_div in (CF,CIS,IS) AND (account_id like '%epreciation%' OR account_nm like
--     '%감가상각%') AND account_nm not like '%누계액%') 로 세어도 **911사**뿐이다.
--     즉 finstate_all 에 감가상각 라인을 아예 싣지 않는 회사가 3분의 2다. 따라서
--     **EBITDA 는 전 종목 지표가 아니다** — 약 3분의 1에서만 계산되고 나머지는 NULL 이다.
--     `where ebitda > x` 같은 스크리닝은 시장의 3분의 2를 조용히 버린다. 그래도 넣는
--     이유는, 있는 회사에서는 정확한 값이고 대안(영업이익만으로 대체)이 더 나쁘기 때문이다.
--   - 사채·유동성사채가 낮은 것은 "사채를 발행한 회사가 적다"는 실제 사실이 섞여 있어
--     감가상각비와 성질이 다르다(미보고가 아니라 미발행). 그래서 borrowings_total 은
--     다섯 개념 중 **하나라도 잡히면** 합산하고, 하나도 없으면 NULL 로 둔다 — "차입금 0"과
--     "태그를 못 잡았다"를 값으로 구분하지 않는다. net_debt 도 마찬가지로 borrowings_total
--     과 cash 가 둘 다 있을 때만 계산한다.
--
--   전환사채·신주인수권부사채·교환사채(dart_ConvertibleBonds 664사 등)는 **넣지 않았다** —
--   자본연계 증권이라 순차입금 정의가 갈리고(전환 가정 여부), 지금 결정할 근거가 없다.
--   알려진 공백으로 남긴다.
--
--   개념 하나가 한 스코프(corp,year,fs_div)에서 여러 account_id 로 동시에 잡히는 비율도
--   쟀다(값이 서로 다른 경우 기준): cogs 0.1% · cash 0.2% · lt_borrowings 0.2% ·
--   current_lt_borrowings 0.2% · sga 0.2% · st_borrowings 0.9% · bonds 2.5% ·
--   amortisation 3.2% · **depreciation 8.8%**. 감가상각비가 높은 건 유형자산/사용권자산/
--   투자부동산 감가상각비를 따로 싣는 회사 때문이다. 기존 9개 개념과 동일하게 max(amount)
--   로 하나를 고른다 — 합산하면 같은 항목을 두 태그로 실은 회사에서 이중계상이 된다.
--
-- ─────────────────────────────────────────────── is_stock — 왜 컬럼이 필요한가
--
-- 분기 파생 규칙이 플로우와 스톡에서 정반대다(3부). 그런데 "이 개념이 플로우냐 스톡이냐"는
-- 사실(fact)의 sj_div 가 아니라 **개념의 성질**이다 — 같은 개념이 CF 와 CIS 양쪽에서 오는
-- 경우(감가상각비)가 있어서 sj_div 로 판정하면 회사마다 갈린다. 그래서 개념 테이블에 둔다.
-- "개념 추가 = account_concepts 행 추가" 원칙은 유지된다(컬럼 하나가 늘 뿐이다).

alter table account_concepts
  add column if not exists is_stock boolean not null default false;

comment on column account_concepts.is_stock is
  '시점값(스톡, 재무상태표)이면 true, 기간값(플로우, 손익·현금흐름)이면 false. '
  'fin_periods 의 분기 환산이 이 값으로 갈린다 — 플로우만 4분기 차감·TTM 합산 대상이고 '
  '스톡은 시점값 그대로 옮기며 TTM 은 합이 아니라 기말 잔액을 싣는다.';

update account_concepts set is_stock = true
  where concept in ('assets', 'liabilities', 'equity');

insert into account_concepts (concept, label, account_id, account_id_alts, name_alts, is_stock) values
  ('cogs', '매출원가', 'ifrs-full_CostOfSales',
     array['ifrs_CostOfSales'],
     array['매출원가'], false),
  ('sga', '판매비와관리비', 'dart_TotalSellingGeneralAdministrativeExpenses',
     array['ifrs-full_SellingGeneralAndAdministrativeExpense'],
     array['판매비와관리비','판매비와일반관리비','판매관리비','판매비및관리비'], false),
  ('depreciation', '감가상각비', 'dart_AdjustmentsForDepreciationExpense',
     array['ifrs-full_AdjustmentsForDepreciationExpense','dart_DepreciationExpense','ifrs-full_DepreciationExpense'],
     array['감가상각비'], false),
  ('amortisation', '무형자산상각비', 'dart_AdjustmentsForAmortisationExpense',
     array['ifrs-full_AdjustmentsForAmortisationExpense','dart_AmortisationExpense','ifrs-full_AmortisationExpense'],
     array['무형자산상각비'], false),
  ('cash', '현금및현금성자산', 'ifrs-full_CashAndCashEquivalents',
     array['ifrs_CashAndCashEquivalents'],
     array['현금및현금성자산'], true),
  ('st_borrowings', '단기차입금', 'ifrs-full_ShorttermBorrowings',
     array['ifrs_ShorttermBorrowings','dart_ShortTermBorrowings',
           'ifrs-full_CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings',
           'ifrs-full_CurrentLoansReceivedAndCurrentPortionOfNoncurrentLoansReceived'],
     array['단기차입금'], true),
  ('current_lt_borrowings', '유동성장기차입금', 'ifrs-full_CurrentPortionOfLongtermBorrowings',
     array['ifrs_CurrentPortionOfLongtermBorrowings'],
     array['유동성장기차입금','유동성장기부채'], true),
  ('lt_borrowings', '장기차입금', 'dart_LongTermBorrowingsGross',
     array['ifrs-full_LongtermBorrowings','ifrs_LongtermBorrowings',
           'ifrs-full_NoncurrentPortionOfNoncurrentLoansReceived',
           'ifrs-full_NoncurrentPortionOfOtherNoncurrentBorrowings'],
     array['장기차입금'], true),
  ('bonds', '사채', 'dart_BondsIssued',
     array['ifrs-full_BondsIssued','ifrs-full_NoncurrentPortionOfNoncurrentBondsIssued','dart_BondsIssuedNominalValue'],
     array['사채'], true),
  ('current_bonds', '유동성사채', 'dart_CurrentPortionOfBonds',
     array['ifrs-full_CurrentBondsIssuedAndCurrentPortionOfNoncurrentBondsIssued'],
     array['유동성사채'], true)
on conflict (concept) do nothing;

-- ─────────────────────────────────────────────── 2부. fin_periods
--
-- wide 인 이유: 스크리너의 본질이 `opm_pct > 15 AND debt_ratio_pct < 100` 을 종목 간에
-- 거는 것이다. long(EAV)이면 술어마다 self-join 이 붙는다. 대가는 정직하게 적어둔다 —
-- 새 지표를 이 표면에 노출하려면 컬럼 추가(마이그레이션)가 필요하다. 확장성은 long 계층
-- (account_concepts + financial_metrics)이 갖고, 여기는 **스크리너 표면**이다. 둘 다 필요하고
-- 하나가 다른 하나를 대체하지 않는다.
--
-- annual_summary·financial_metrics 는 **손대지 않는다**. apps/web 이 그 둘을 읽고 있고,
-- 웹앱을 이 테이블로 옮기는 것은 검증 이후의 별도 작업이다.

create table fin_periods (
  corp_code       text not null references companies on delete cascade,
  period_key      text not null,   -- '2024A' | '2024Q1'~'2024Q4' | '2024TTM'
  fs_div          text not null,   -- 'CFS'(연결) | 'OFS'(별도)
  bsns_year       integer not null,
  period_type     text not null check (period_type in ('A','Q1','Q2','Q3','Q4','TTM')),
  ttm_end_period  text,            -- TTM 행에서만 — 'YYYYQn' (그 TTM 이 끝나는 분기)

  -- 플로우(기간값)
  revenue          numeric,
  cogs             numeric,
  gross_profit     numeric,        -- 파생: revenue - cogs
  sga              numeric,
  operating_income numeric,
  net_income       numeric,
  depreciation     numeric,
  amortisation     numeric,
  ebitda           numeric,        -- 파생: operating_income + depreciation + amortisation
  cf_operating     numeric,
  cf_investing     numeric,
  cf_financing     numeric,

  -- 스톡(시점값)
  assets                numeric,
  liabilities           numeric,
  equity                numeric,
  cash                  numeric,
  st_borrowings         numeric,
  current_lt_borrowings numeric,
  lt_borrowings         numeric,
  bonds                 numeric,
  current_bonds         numeric,
  borrowings_total      numeric,   -- 파생: 위 다섯의 합
  net_debt              numeric,   -- 파생: borrowings_total - cash

  -- 비율(%) — annual_summary 와 **같은 식·같은 반올림**을 쓴다(교차검증이 성립해야 하므로)
  gpm_pct        numeric,
  opm_pct        numeric,
  npm_pct        numeric,
  roe_pct        numeric,
  debt_ratio_pct numeric,

  computed_at timestamptz not null default now(),

  primary key (corp_code, period_key, fs_div)
);

comment on table fin_periods is
  '파생 지표 계층 — (corp_code, period_key, fs_div) 단위 wide 실체 테이블. financial_facts 에서 '
  'internal.fin_periods_refresh() 가 계산해 채운다. 원본이 아니라 **파생물**이므로 언제든 '
  '통째로 버리고 다시 만들 수 있다. 갱신은 자동이 아니다 — 아래 3부 참고.';
comment on column fin_periods.period_key is
  'bsns_year || period_type. 연간 2024A, 분기 2024Q1~2024Q4, TTM 2024TTM.';
comment on column fin_periods.ttm_end_period is
  'TTM 행이 끝나는 분기(''2026Q1'' 형식). TTM 은 그 해에 존재하는 마지막 분기에서 뒤로 4개 '
  '분기를 합친 값이다 — 4분기가 다 있으면 연간과 같아지고, 진행 중인 해에서 비로소 의미가 있다.';
comment on column fin_periods.roe_pct is
  '100 * net_income / equity. **분기 행에서는 연율화하지 않는다** — 분기 순이익을 그 시점 '
  '자본으로 나눈 값이라 연간 ROE 와 직접 비교하면 안 된다. 연간 비교는 period_type=''A'' 나 '
  '''TTM'' 행을 쓴다.';
comment on column fin_periods.ebitda is
  'operating_income + depreciation + coalesce(amortisation,0). depreciation 이 없으면 NULL — '
  '실측상 감가상각 라인을 싣는 회사가 33.7%뿐이라 **이 컬럼은 전 종목 지표가 아니다**(1부 참고).';
comment on column fin_periods.borrowings_total is
  '단기차입금+유동성장기차입금+장기차입금+사채+유동성사채. 다섯 중 하나도 잡히지 않으면 NULL — '
  '"차입금이 0"과 "태그를 못 잡았다"를 0 으로 뭉개지 않는다. 전환사채·신주인수권부사채·교환사채는 '
  '포함하지 않는다(자본연계 증권 — 알려진 공백).';

-- ─────────────────────────────────────────────── 인덱스
--
-- 접근 패턴이 둘이다.
--   (1) 종목 화면 — "이 회사의 전 기간": PK (corp_code, period_key, fs_div) 의 선행 컬럼
--       하나로 끝난다. 별도 인덱스가 필요 없다.
--   (2) 스크리너 — "특정 기간, 전 종목을 지표로 거른다": 술어가 걸리는 컬럼이 지표 30여 개
--       중 무엇이든 될 수 있어서 지표마다 인덱스를 만드는 것은 무의미하다(조합이 폭발한다).
--       대신 **후보 집합을 먼저 좁히는 축**에 건다 — (period_type, bsns_year) 로 좁히면
--       약 2,600행이고, 그 위의 지표 술어는 메모리에서 필터하면 된다. 이게 fp_period 다.
-- 정렬(order by opm_pct desc limit 50) 까지 인덱스로 받고 싶어지면 그때 부분 인덱스를
-- 추가하면 된다 — 지금은 대상이 2,600행이라 정렬 비용이 문제가 아니다.
create index fp_period on fin_periods (period_type, bsns_year);

alter table fin_periods enable row level security;
-- permissive 정책을 만들지 않는다(의도적 누락) — anon/authenticated 는 기본 거부.
-- 20260802000005 의 `alter default privileges ... revoke all on tables from anon,
-- authenticated` 가 호스티드의 자동 grant 를 이미 끊어두었지만(pg_default_acl 실측:
-- postgres 가 만드는 릴레이션의 기본 ACL 은 postgres·service_role 뿐이다), 그 마이그레이션의
-- 원칙 그대로 **거부는 두 겹**이어야 한다. 명시적으로 한 번 더 회수한다.
revoke all on fin_periods from anon, authenticated;
grant select, insert, update, delete on fin_periods to service_role;
-- PK 가 (text,text,text) 복합키라 identity 시퀀스가 없다 — 시퀀스 grant 불필요.

-- ─────────────────────────────────────────────── 3부. 계산 규칙과 갱신 전략
--
-- 분기 의미론은 호스티드 실측으로 확정된 것을 그대로 쓴다(HIDM-2 3절). 삼성전자 2024
-- 매출액(CFS): amount 가 1Q 71.9조 / 2Q 74.1조 / 3Q 79.1조이고 amount_cum 이 71.9 → 146.0
-- → 225.1 이다. 71.9+74.1+79.1 = 225.1 — 즉 **amount 는 이미 해당 분기 단독(3개월)**이고
-- 누적은 amount_cum 에 따로 온다. HIPRD-2 에 있던 "분기는 누적이라 차감이 필요하다"는
-- 서술은 틀렸고 이미 정정됐다.
--   Q1/Q2/Q3 단독 = amount (reprt_code 11013 / 11012 / 11014)
--   Q4 단독       = 연간 amount − 3분기 amount_cum   ← 4분기만 별도 보고서가 없다
--   TTM           = 최근 4개 분기 단독의 합
--   스톡(BS)      = 변환하지 않는다. Q4 스톡은 "연간 − 3분기누적"이 아니라 **연말 잔액**
--                   (= 연간 보고서의 amount)이고, TTM 스톡은 합이 아니라 종료 분기의 잔액이다.
--                   재무상태표 항목을 합산하는 것은 의미가 없다.
--
-- ─── 갱신을 어떻게 돌릴 것인가 (세 안을 놓고 결정한다)
--
--   (a) public 스키마 DB 함수 + PostgREST /rpc — 깔끔한 REFRESH 를 얻지만 새 RPC 표면이
--       생긴다. 20260802000005/000006 의 `alter default privileges` 는 **테이블·시퀀스만**
--       덮고 함수는 안 덮는다. 함수는 기본적으로 PUBLIC 에 EXECUTE 가 붙는다. 자연키를
--       만들 때(20260803000002) 바로 이 이유로 사용자 함수를 피하고 extensions.digest 를
--       썼다. 그 문을 가볍게 다시 열지 않는다. **기각.**
--   (b) 실체화 뷰(materialized view) — REFRESH 한 줄로 끝나지만 (b-1) 어차피 그 한 줄을
--       실행할 주체가 여전히 필요하고, (b-2) 증분(변경된 corp_code 만)이 불가능해 매번
--       전량 재계산이며, (b-3) concurrently 를 쓰려면 유니크 인덱스가 필요하고 그동안
--       테이블이 잠긴다. HIDM-2 8절이 요구하는 "신규 공시를 적재한 종목만 재계산"이
--       구조적으로 안 된다. **기각.**
--   (c) 수동 실행 — 정직하지만 그대로 두면 계산 규칙이 어딘가의 스크립트로 새어나간다.
--
-- **채택: (c) 를 택하되, 계산 규칙은 노출되지 않는 스키마의 함수로 스키마 옆에 둔다.**
-- internal 스키마는 PostgREST 노출 스키마가 아니므로(노출 대상은 public·graphql_public)
-- /rpc 표면이 늘지 않는다 — (a) 의 이득(규칙이 스키마 옆에 있고, 증분 재계산이 한 줄)만
-- 취하고 대가는 피한다. 대신 **호출은 SQL 연결에서만 가능하다** — ingest 는 PostgREST 로
-- 말하므로 자기가 적재한 뒤 스스로 갱신을 부를 수 없다.
--
--   ★ 알려진 공백(자동화 아님): financial_facts 가 바뀌어도 fin_periods 는 저절로 따라오지
--     않는다. 백필·신규 적재 뒤에 운영자가 다음 한 줄을 직접 돌려야 한다.
--       전량:   select * from internal.fin_periods_refresh();
--       증분:   select * from internal.fin_periods_refresh(array['00126380','00266961']);
--     (supabase db query --linked, psql, 대시보드 SQL 에디터 중 아무거나)
--     자동화하려면 ingest 에 DB 커넥션을 주거나(현재 stdlib 전용 원칙과 충돌) 스케줄러를
--     붙여야 한다 — 둘 다 이 마이그레이션의 범위 밖이고, 지금은 수동임을 명시해 둔다.
--     트리거는 검토하지 않았다: 백필이 초당 수백 행을 넣는 동안 행마다 재계산하면 비용이
--     감당이 안 된다(HIDM-2 8절과 같은 판단).

create schema if not exists internal;
comment on schema internal is
  '서버 전용 유지보수 루틴. **PostgREST 노출 스키마가 아니다** — 여기에 있는 함수는 /rpc 로 '
  '올라오지 않는다. public 에 함수를 만들지 않기 위한 자리다(20260803000002 참고).';
revoke all on schema internal from public;
grant usage on schema internal to service_role;

-- 한 회사분을 통째로 다시 만든다. 파생물이므로 delete → insert 가 가장 단순하고,
-- 정정으로 어떤 기간이 사라지는 경우까지 자연히 처리된다.
create or replace function internal.fin_periods_rebuild(p_corp text)
returns bigint
language plpgsql
set search_path = public, pg_temp
as $fn$
declare n bigint;
begin
  delete from fin_periods where corp_code = p_corp;

  insert into fin_periods (
    corp_code, period_key, fs_div, bsns_year, period_type, ttm_end_period,
    revenue, cogs, gross_profit, sga, operating_income, net_income,
    depreciation, amortisation, ebitda,
    cf_operating, cf_investing, cf_financing,
    assets, liabilities, equity,
    cash, st_borrowings, current_lt_borrowings, lt_borrowings, bonds, current_bonds,
    borrowings_total, net_debt,
    gpm_pct, opm_pct, npm_pct, roe_pct, debt_ratio_pct
  )
  -- f: 개념 단위 사실. 조인 조건은 financial_metrics 뷰와 **글자 그대로 같다** —
  --    같아야 annual_summary 와의 교차검증이 성립한다.
  with f as (
    select ff.bsns_year, ff.reprt_code, ff.fs_div, ac.concept, ac.is_stock,
           ff.amount, ff.amount_cum
    from financial_facts ff
    join account_concepts ac
      on (nullif(ff.account_id, '-표준계정코드 미사용-') = ac.account_id)
      or (ff.account_id = any(ac.account_id_alts))
      or ((ff.account_id is null or ff.account_id = '-표준계정코드 미사용-')
          and ff.account_nm = any(ac.name_alts))
    where ff.corp_code = p_corp
      and ff.amount is not null
      and ff.fs_div is not null
      and ff.bsns_year is not null
  ),
  -- agg: (연도, fs_div, 개념) 하나당 보고서 4종의 슬롯. 개념 하나가 여러 태그로 잡히면
  --      max 로 하나를 고른다 — annual_summary 의 max(amount) 와 같은 규칙이다.
  agg as (
    select bsns_year, fs_div, concept, bool_or(is_stock) as is_stock,
           max(amount)     filter (where reprt_code = '11011') as a_y,
           max(amount)     filter (where reprt_code = '11013') as a_q1,
           max(amount)     filter (where reprt_code = '11012') as a_q2,
           max(amount)     filter (where reprt_code = '11014') as a_q3,
           max(amount_cum) filter (where reprt_code = '11014') as c_q3
    from f group by 1, 2, 3
  ),
  -- base: 기간별 long 행. Q4 만 계산이 들어간다(플로우는 차감, 스톡은 연말 잔액).
  base as (
    select bsns_year, fs_div, 'A'::text as period_type, concept, is_stock,
           a_y as v, null::integer as end_qi
      from agg where a_y is not null
    union all
    select bsns_year, fs_div, 'Q1', concept, is_stock, a_q1, null from agg where a_q1 is not null
    union all
    select bsns_year, fs_div, 'Q2', concept, is_stock, a_q2, null from agg where a_q2 is not null
    union all
    select bsns_year, fs_div, 'Q3', concept, is_stock, a_q3, null from agg where a_q3 is not null
    union all
    select bsns_year, fs_div, 'Q4', concept, is_stock,
           case when is_stock then a_y else a_y - c_q3 end, null
      from agg where a_y is not null and (is_stock or c_q3 is not null)
  ),
  -- q: 분기에 통시적 인덱스 qi = 연도*4 + n 을 붙인다. TTM 창이 연도 경계를 넘기 위해서다.
  q as (
    select bsns_year, fs_div, concept, is_stock, v,
           bsns_year * 4 + substr(period_type, 2, 1)::integer as qi
    from base where period_type in ('Q1','Q2','Q3','Q4')
  ),
  -- ttm_end: 그 해에 존재하는 마지막 분기. TTM 의 기준 시점을 여기서 고정한다
  --          (HIDM-2 10절 "TTM 을 어느 시점 기준으로 고정할 것인가"에 대한 답).
  ttm_end as (
    select fs_div, bsns_year, max(qi) as end_qi from q group by 1, 2
  ),
  ttm as (
    select t.bsns_year, t.fs_div, 'TTM'::text as period_type, q.concept,
           case when bool_or(q.is_stock)
                  then max(q.v) filter (where q.qi = t.end_qi)   -- 스톡: 종료 분기의 잔액
                when count(*) = 4
                  then sum(q.v)                                   -- 플로우: 4개가 다 있을 때만
           end as v,
           t.end_qi
    from ttm_end t
    join q on q.fs_div = t.fs_div and q.qi between t.end_qi - 3 and t.end_qi
    group by t.bsns_year, t.fs_div, q.concept, t.end_qi
  ),
  long as (
    select bsns_year, fs_div, period_type, concept, v, end_qi from base
    union all
    select bsns_year, fs_div, period_type, concept, v, end_qi from ttm where v is not null
  ),
  p as (
    select bsns_year, fs_div, period_type, max(end_qi) as ttm_end_qi,
           max(v) filter (where concept = 'revenue')               as revenue,
           max(v) filter (where concept = 'cogs')                  as cogs,
           max(v) filter (where concept = 'sga')                   as sga,
           max(v) filter (where concept = 'operating_income')      as operating_income,
           max(v) filter (where concept = 'net_income')            as net_income,
           max(v) filter (where concept = 'depreciation')          as depreciation,
           max(v) filter (where concept = 'amortisation')          as amortisation,
           max(v) filter (where concept = 'cf_operating')          as cf_operating,
           max(v) filter (where concept = 'cf_investing')          as cf_investing,
           max(v) filter (where concept = 'cf_financing')          as cf_financing,
           max(v) filter (where concept = 'assets')                as assets,
           max(v) filter (where concept = 'liabilities')           as liabilities,
           max(v) filter (where concept = 'equity')                as equity,
           max(v) filter (where concept = 'cash')                  as cash,
           max(v) filter (where concept = 'st_borrowings')         as st_borrowings,
           max(v) filter (where concept = 'current_lt_borrowings') as current_lt_borrowings,
           max(v) filter (where concept = 'lt_borrowings')         as lt_borrowings,
           max(v) filter (where concept = 'bonds')                 as bonds,
           max(v) filter (where concept = 'current_bonds')         as current_bonds
    from long group by 1, 2, 3
  ),
  d as (
    select p.*,
           case when revenue is not null and cogs is not null then revenue - cogs end as gross_profit,
           case when operating_income is not null and depreciation is not null
                then operating_income + depreciation + coalesce(amortisation, 0) end as ebitda,
           case when coalesce(st_borrowings, current_lt_borrowings, lt_borrowings,
                              bonds, current_bonds) is not null
                then coalesce(st_borrowings, 0) + coalesce(current_lt_borrowings, 0)
                   + coalesce(lt_borrowings, 0) + coalesce(bonds, 0) + coalesce(current_bonds, 0)
           end as borrowings_total
    from p
  )
  select
    p_corp,
    bsns_year::text || period_type,
    fs_div, bsns_year, period_type,
    case when period_type = 'TTM' and ttm_end_qi is not null
         then ((ttm_end_qi - 1) / 4)::text || 'Q'
              || (ttm_end_qi - ((ttm_end_qi - 1) / 4) * 4)::text end,
    revenue, cogs, gross_profit, sga, operating_income, net_income,
    depreciation, amortisation, ebitda,
    cf_operating, cf_investing, cf_financing,
    assets, liabilities, equity,
    cash, st_borrowings, current_lt_borrowings, lt_borrowings, bonds, current_bonds,
    borrowings_total,
    case when borrowings_total is not null and cash is not null
         then borrowings_total - cash end,
    round(100.0 * gross_profit     / nullif(revenue, 0), 1),
    round(100.0 * operating_income / nullif(revenue, 0), 1),
    round(100.0 * net_income       / nullif(revenue, 0), 1),
    round(100.0 * net_income       / nullif(equity,  0), 1),
    round(100.0 * liabilities      / nullif(equity,  0), 1)
  from d;

  get diagnostics n = row_count;
  return n;
end;
$fn$;

comment on function internal.fin_periods_rebuild(text) is
  'fin_periods 에서 한 회사분을 지우고 financial_facts 로부터 다시 계산한다. 계산 규칙의 '
  '단일 정의 — 다른 어디에도 사본이 없다.';

create or replace function internal.fin_periods_refresh(p_corps text[] default null)
returns table (corps integer, rows_written bigint)
language plpgsql
set search_path = public, pg_temp
as $fn$
declare c text; n bigint; tot bigint := 0; cnt integer := 0;
begin
  -- 회사 단위 루프인 이유: financial_facts 를 통째로 집계하면 1,392만 행짜리 해시집계가
  -- 디스크로 흘러넘친다. 회사별로 돌면 ff_lookup 인덱스(corp_code 선행)로 회사당 수천 행만
  -- 읽고 끝난다. 증분 갱신(p_corps 지정)이 같은 코드로 자연히 나오는 것은 덤이다.
  for c in
    select corp_code from companies
    where p_corps is null or corp_code = any(p_corps)
    order by corp_code
  loop
    n := internal.fin_periods_rebuild(c);
    tot := tot + n;
    cnt := cnt + 1;
  end loop;
  corps := cnt; rows_written := tot; return next;
end;
$fn$;

comment on function internal.fin_periods_refresh(text[]) is
  'fin_periods 갱신 진입점. 인자 없이 부르면 전량, corp_code 배열을 주면 그 회사만 재계산한다. '
  '**자동 호출되지 않는다** — 백필·신규 적재 뒤 운영자가 SQL 연결에서 직접 실행해야 한다.';

-- 함수는 기본적으로 PUBLIC 에 EXECUTE 가 붙는다(테이블과 다르다). internal 스키마에
-- USAGE 가 없어 실제로는 닿지 못하지만, 여기서도 거부는 두 겹으로 둔다.
revoke all on function internal.fin_periods_rebuild(text)   from public;
revoke all on function internal.fin_periods_refresh(text[]) from public;
grant execute on function internal.fin_periods_refresh(text[]) to service_role;

-- ─────────────────────────────────────────────── 최초 전량 계산은 여기 없다
--
-- 초안에서는 이 파일 마지막 줄이 `select * from internal.fin_periods_refresh();` 였다.
-- 호스티드에 푸시해보고 뺐다 — **실측으로 안 되는 것을 확인했기 때문이다.**
--
--   `supabase db push --linked` 는 마이그레이션을 Management API 로 보내고, 그 경로에는
--   약 120초 상한이 있다(같은 상한을 db query 쪽에서도 두 번 맞았다: 13,920,062행짜리
--   집계가 123초에서 잘렸다). 전량 계산은 실측 3,978개사 · 회사당 약 50 ms · **약 200초**다.
--   그래서 푸시가 통째로 롤백됐다(to_regclass, schema_migrations 둘 다 비어 있음을 확인 —
--   CLI 가 파일 전체를 트랜잭션으로 감싼다는 20260803000002 의 서술 그대로였다).
--
-- 억지로 밀어 넣을 방법이 없지는 않았다 — 회사 범위를 쪼개 마이그레이션 파일 네 개로
-- 나누면 각 50초라 통과한다. 그러나 그건 "이 시점의 회사 수"라는 우연을 마이그레이션
-- 히스토리에 영구히 박아 넣는 짓이고, 나중에 회사가 늘면 다시 안 맞는다.
--
-- 그래서 **최초 계산도 이후 갱신과 똑같은 운영자 명령 하나**로 통일한다. 채우는 방법이
-- 하나뿐이라는 점에서 오히려 이쪽이 일관적이다.
--
--   전량 (직결 psql — 상한 없음):
--     select * from internal.fin_periods_refresh();
--   전량 (supabase db query --linked — 120초 상한이 있으므로 1,000개사씩 4번):
--     select * from internal.fin_periods_refresh((select array_agg(corp_code)
--       from (select corp_code from companies order by corp_code offset 0 limit 1000) t));
--     -- offset 1000 / 2000 / 3000 으로 세 번 더
--   증분 (신규 공시를 적재한 종목만):
--     select * from internal.fin_periods_refresh(array['00126380','00266961']);
--
-- ★ 이 마이그레이션 직후 fin_periods 는 **비어 있다.** 위 명령을 돌려야 채워진다.
--   (2026-08-06 호스티드 최초 적재 실측: 3,978개사 → 134,279행, 약 200초.)
