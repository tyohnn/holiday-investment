-- 20260823000002 후속 성능 수정 — ri_dividends / ri_dividends_by_class 타임아웃.
--
-- 실측: `select * from ri_dividends where corp_code='00126380' and bsns_year=2024`가
-- "canceling statement due to statement timeout"로 실패했다. 원인은 `explain`으로 확인—
-- company_rows/class_rows CTE가 unpivoted 안에서 UNION ALL 세 갈래에 각각 한 번씩,
-- 총 3번 참조된다. PostgreSQL 12+ 는 "한 번만 참조되는 non-recursive CTE는 인라인,
-- 두 번 이상 참조되면 기본적으로 MATERIALIZED"라 이 CTE가 강제로 실체화됐다 —
-- `explain` 결과가 정확히 그 증거다: CTE company_rows 노드가 `item = '배당'`만 걸고
-- corp_code 조건 없이 report_items 368,803행(item='배당' 전체)을 먼저 통째로 읽고,
-- corp_code/bsns_year 필터는 그 실체화 결과 위의 CTE Scan에서야 걸린다(실체화가
-- 최적화 장벽이라 바깥 술어가 안으로 못 들어간다). 배당 item 368,803행 전체에 대해
-- internal.ri_parse_numeric(정규식 3회)을 미리 다 돌리는 셈이라 statement_timeout을 넘겼다.
--
-- 고정: CTE를 `NOT MATERIALIZED`로 명시해 플래너가 인라인하게 만든다 — 그러면
-- corp_code/bsns_year 술어가 UNION ALL 각 갈래 안으로 내려가 ri_lookup
-- (corp_code, item, bsns_year) 인덱스를 그대로 탄다. 뷰의 나머지 SQL(파싱 규칙,
-- thstrm/frmtrm/lwfr 우선순위, grain)은 20260823000002와 완전히 동일하다 — 성능
-- 힌트 하나만 추가한다. 마이그레이션 파일은 새로 낸다(기존 파일을 고치면 로컬 체크섬과
-- 원격 schema_migrations 기록이 어긋난다 — supabase db push는 버전 번호로 이미 적용
-- 여부를 판단하므로 내용을 바꿔도 재적용되지 않는다).

create or replace view ri_dividends as
with company_rows as not materialized (
  select corp_code, bsns_year, rcept_no,
         payload->>'se' as se,
         payload->>'thstrm' as thstrm,
         payload->>'frmtrm' as frmtrm,
         payload->>'lwfr' as lwfr
  from report_items
  where item = '배당'
    and trim(coalesce(payload->>'stock_knd', '-')) = '-'
),
unpivoted as (
  select corp_code, bsns_year as display_year, se,
         internal.ri_parse_numeric(thstrm) as val, 1 as prio, bsns_year as report_year, rcept_no
  from company_rows
  union all
  select corp_code, bsns_year - 1, se,
         internal.ri_parse_numeric(frmtrm), 2, bsns_year, rcept_no
  from company_rows
  where bsns_year - 1 < 2015
  union all
  select corp_code, bsns_year - 2, se,
         internal.ri_parse_numeric(lwfr), 3, bsns_year, rcept_no
  from company_rows
  where bsns_year - 2 < 2015
),
picked as (
  select distinct on (corp_code, display_year, se)
    corp_code, display_year, se, val, rcept_no
  from unpivoted
  order by corp_code, display_year, se, prio, report_year desc, rcept_no desc
)
select
  corp_code,
  display_year as bsns_year,
  max(rcept_no) as rcept_no,
  max(val) filter (where se = '주당액면가액(원)')           as face_value_per_share,
  max(val) filter (where se = '(연결)당기순이익(백만원)')    as net_income_cfs,
  max(val) filter (where se = '(별도)당기순이익(백만원)')    as net_income_ofs,
  max(val) filter (where se = '(연결)주당순이익(원)')        as eps_cfs,
  max(val) filter (where se = '현금배당금총액(백만원)')      as cash_dividend_total,
  max(val) filter (where se = '주식배당금총액(백만원)')      as stock_dividend_total,
  max(val) filter (where se = '(연결)현금배당성향(%)')       as cash_payout_ratio_pct
from picked
group by corp_code, display_year;

comment on view ri_dividends is
  'report_items(item=''배당'', DART alotMatter)의 회사 레벨(stock_knd=''-'') 7항목 wide 파생. '
  'grain=(corp_code, bsns_year). thstrm/frmtrm/lwfr 3개년 중복은 "당해 보고서 thstrm 우선, '
  '2015년 이전만 frmtrm/lwfr 백필"로 병합했다(감독 결정 #2) — bsns_year=2015가 전 회사 '
  'report_items의 최솟값이라 이 조건이 "자기 보고서가 없는 연도만 백필"과 동치임을 호스티드 '
  '실측으로 확인했다. 종류주(보통주/우선주) 레벨 4항목은 ri_dividends_by_class를 본다. '
  '배당락일·지급일은 만들 수 없다 — 원본에 날짜 필드가 없다(설계 문서 §1-C). '
  '★ company_rows CTE는 NOT MATERIALIZED — 3번 참조되는 CTE를 기본값(MATERIALIZED)으로 '
  '두면 corp_code 술어가 밀려 못 들어가 item=''배당'' 전체(368,803행)를 먼저 실체화한다 '
  '(20260823000003에서 statement_timeout으로 실측, 원인은 explain으로 확인).';

revoke all on ri_dividends from anon, authenticated;
grant select on ri_dividends to service_role;

create or replace view ri_dividends_by_class as
with class_rows as not materialized (
  select corp_code, bsns_year, rcept_no,
         trim(payload->>'stock_knd') as stock_knd,
         payload->>'se' as se,
         payload->>'thstrm' as thstrm,
         payload->>'frmtrm' as frmtrm,
         payload->>'lwfr' as lwfr
  from report_items
  where item = '배당'
    and trim(coalesce(payload->>'stock_knd', '-')) <> '-'
),
unpivoted as (
  select corp_code, stock_knd, bsns_year as display_year, se,
         internal.ri_parse_numeric(thstrm) as val, 1 as prio, bsns_year as report_year, rcept_no
  from class_rows
  union all
  select corp_code, stock_knd, bsns_year - 1, se,
         internal.ri_parse_numeric(frmtrm), 2, bsns_year, rcept_no
  from class_rows
  where bsns_year - 1 < 2015
  union all
  select corp_code, stock_knd, bsns_year - 2, se,
         internal.ri_parse_numeric(lwfr), 3, bsns_year, rcept_no
  from class_rows
  where bsns_year - 2 < 2015
),
picked as (
  select distinct on (corp_code, stock_knd, display_year, se)
    corp_code, stock_knd, display_year, se, val, rcept_no
  from unpivoted
  order by corp_code, stock_knd, display_year, se, prio, report_year desc, rcept_no desc
)
select
  corp_code,
  stock_knd,
  display_year as bsns_year,
  max(rcept_no) as rcept_no,
  max(val) filter (where se = '현금배당수익률(%)')     as cash_dividend_yield_pct,
  max(val) filter (where se = '주식배당수익률(%)')     as stock_dividend_yield_pct,
  max(val) filter (where se = '주당 현금배당금(원)')    as cash_dividend_per_share,
  max(val) filter (where se = '주당 주식배당(주)')      as stock_dividend_per_share
from picked
group by corp_code, stock_knd, display_year;

comment on view ri_dividends_by_class is
  'ri_dividends와 짝을 이루는 종류주(stock_knd∈{보통주,우선주,종류주식,...}) 레벨 4항목 wide '
  '파생. grain=(corp_code, stock_knd, bsns_year). thstrm/frmtrm/lwfr 병합 규칙은 '
  'ri_dividends와 동일(당해 우선, 2015년 이전만 백필). ★ class_rows CTE도 NOT MATERIALIZED '
  '— ri_dividends와 동일한 성능 버그·수정(20260823000003 참고).';

revoke all on ri_dividends_by_class from anon, authenticated;
grant select on ri_dividends_by_class to service_role;
