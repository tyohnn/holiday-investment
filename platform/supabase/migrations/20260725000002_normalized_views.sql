-- 정규화 뷰 — A1 시행착오에서 도출.
--
-- 발견: 회사마다 계정명이 다르다 (크래프톤 '영업수익' vs 에코프로비엠 '매출액').
-- 계정명으로 조인하면 종목마다 깨진다. 그런데 DART 응답의 XBRL account_id 는
-- 둘 다 ifrs-full_Revenue 로 동일했다 — 표준 ID 가 변형을 흡수한다.
-- 따라서 정규화 축은 account_nm 이 아니라 account_id 로 간다.
-- (account_id 가 비는 계정은 이름 폴백을 둔다 — 일부 회사·과거 연도에서 발생)

create table account_concepts (
  concept    text primary key,       -- revenue | operating_income | …
  label      text not null,
  account_id text,                   -- XBRL 표준 ID (1순위)
  name_alts  text[]                  -- 폴백: 계정명 후보
);

insert into account_concepts (concept, label, account_id, name_alts) values
  ('revenue',          '매출액',       'ifrs-full_Revenue',
     array['매출액','영업수익','수익(매출액)','매출']),
  ('operating_income', '영업이익',     'dart_OperatingIncomeLoss',
     array['영업이익','영업이익(손실)']),
  ('net_income',       '당기순이익',   'ifrs-full_ProfitLoss',
     array['당기순이익','당기순이익(손실)','분기순이익','반기순이익','연결당기순이익']),
  ('assets',           '자산총계',     'ifrs-full_Assets',            array['자산총계']),
  ('liabilities',      '부채총계',     'ifrs-full_Liabilities',       array['부채총계']),
  ('equity',           '자본총계',     'ifrs-full_Equity',            array['자본총계']),
  ('cf_operating',     '영업활동현금흐름', 'ifrs-full_CashFlowsFromUsedInOperatingActivities',
     array['영업활동현금흐름','영업활동으로인한현금흐름','영업활동순현금흐름']),
  ('cf_investing',     '투자활동현금흐름', 'ifrs-full_CashFlowsFromUsedInInvestingActivities',
     array['투자활동현금흐름','투자활동으로인한현금흐름','투자활동순현금흐름']),
  ('cf_financing',     '재무활동현금흐름', 'ifrs-full_CashFlowsFromUsedInFinancingActivities',
     array['재무활동현금흐름','재무활동으로인한현금흐름','재무활동순현금흐름']);

-- 개념 단위 재무 사실 — UI·분석은 이 뷰만 본다
create view financial_metrics as
select
  ff.corp_code, ff.bsns_year, ff.reprt_code, ff.fs_div,
  ac.concept, ac.label,
  ff.amount, ff.amount_prev, ff.rcept_no,
  ff.account_nm as raw_account_nm          -- 어떤 이름으로 왔는지 추적 가능하게 유지
from financial_facts ff
join account_concepts ac
  on (ff.account_id is not null and ff.account_id = ac.account_id)
  or (ff.account_id is null and ff.account_nm = any(ac.name_alts))
where ff.amount is not null;

-- 연간 요약 + 파생 지표 (종목 페이지의 재무 차트가 읽는 표면)
create view annual_summary as
with m as (
  select corp_code, bsns_year, concept, max(amount) as amount
  from financial_metrics
  where reprt_code = '11011'
  group by 1, 2, 3
)
select
  corp_code, bsns_year,
  max(amount) filter (where concept = 'revenue')          as revenue,
  max(amount) filter (where concept = 'operating_income')  as operating_income,
  max(amount) filter (where concept = 'net_income')        as net_income,
  max(amount) filter (where concept = 'assets')            as assets,
  max(amount) filter (where concept = 'liabilities')       as liabilities,
  max(amount) filter (where concept = 'equity')            as equity,
  max(amount) filter (where concept = 'cf_operating')      as cf_operating,
  round(100.0 * max(amount) filter (where concept = 'operating_income')
        / nullif(max(amount) filter (where concept = 'revenue'), 0), 1)   as opm_pct,
  round(100.0 * max(amount) filter (where concept = 'net_income')
        / nullif(max(amount) filter (where concept = 'equity'), 0), 1)    as roe_pct,
  round(100.0 * max(amount) filter (where concept = 'liabilities')
        / nullif(max(amount) filter (where concept = 'equity'), 0), 1)    as debt_ratio_pct
from m group by 1, 2;

-- 정정 체인 — 같은 보고서의 원본/정정본을 한 줄로 (기재정정 추적)
create view filing_corrections as
select corp_code, rcept_no, report_nm, rcept_dt,
       regexp_replace(report_nm, '^\[기재정정\]\s*', '') as base_report_nm
from filings where is_correction;

grant select on account_concepts, financial_metrics, annual_summary, filing_corrections
  to anon, authenticated, service_role;
alter table account_concepts enable row level security;
create policy "public read" on account_concepts for select using (true);
