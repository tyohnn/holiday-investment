-- ri_dividends 후속 수정 — se 라벨이 연도에 따라 바뀐다(회사 레벨 2개 항목).
--
-- 검증 중 실측: 삼성전자 2014년 배당 데이터(bsns_year=2015 보고서의 frmtrm으로 백필된 값)를
-- 확인하다가 net_income_ofs(별도당기순이익)가 NULL로 나오는 것을 발견했다. 원인을 추적한
-- 결과 — report_items의 '배당' item은 se 라벨 텍스트 자체가 시간에 따라 바뀌었다:
--
--   전체 스캔(company_rows, stock_knd='-') distinct se 실측:
--     "(개별)당기순이익(백만원)"   1,799행   ← 구 라벨
--     "(별도)당기순이익(백만원)"  21,075행   ← 신 라벨(20260823000002가 하드코딩한 값)
--     "주당순이익(원)"             1,755행   ← 구 라벨(연결 접두 없음)
--     "(연결)주당순이익(원)"      22,874행   ← 신 라벨(20260823000002가 하드코딩한 값)
--   나머지 5항목(주당액면가액·연결당기순이익·현금배당금총액·주식배당금총액·연결현금배당성향)은
--   전부 정확히 24,629행으로 총 행수와 일치 — 이 둘만 라벨이 갈렸다. 클래스 레벨 4항목
--   (현금배당수익률·주식배당수익률·주당현금배당금·주당주식배당)은 라벨 드리프트가 없음을
--   별도로 확인했다(distinct se가 정확히 4종).
--
-- 20260823000002는 2024년 데이터 하나만 보고 se 라벨을 하드코딩했다 — 오래된 연도(대략
-- 2016년 이전 보고서 vintage)에서 DART 서식이 "개별"→"별도", "주당순이익"→"연결주당순이익"
-- 으로 라벨을 바꾼 사실을 놓쳤다. 감독 결정 #2(당해 보고서 thstrm 우선, 2015년 이전만
-- 백필)의 백필 경로가 정확히 이 구 라벨 시기의 보고서를 가리키기 때문에 실무 영향이 있다 —
-- 고치지 않으면 2015년 이전 백필 연도의 별도당기순이익·EPS가 항상 NULL이 된다.
--
-- 고정: 두 항목만 se IN (...) 로 구·신 라벨을 모두 잡는다. 나머지 5항목·클래스 레벨 4항목은
-- 라벨 드리프트가 없음을 실측했으므로 그대로 둔다. CTE NOT MATERIALIZED(20260823000003)는
-- 그대로 유지한다.

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
  max(val) filter (where se = '주당액면가액(원)')                                    as face_value_per_share,
  max(val) filter (where se = '(연결)당기순이익(백만원)')                             as net_income_cfs,
  -- 구 라벨("개별") / 신 라벨("별도") 둘 다 잡는다 — 위 마이그레이션 서문 참고.
  max(val) filter (where se in ('(별도)당기순이익(백만원)', '(개별)당기순이익(백만원)')) as net_income_ofs,
  -- 구 라벨(접두 없음) / 신 라벨("연결" 접두) 둘 다 잡는다.
  max(val) filter (where se in ('(연결)주당순이익(원)', '주당순이익(원)'))             as eps_cfs,
  max(val) filter (where se = '현금배당금총액(백만원)')                              as cash_dividend_total,
  max(val) filter (where se = '주식배당금총액(백만원)')                              as stock_dividend_total,
  max(val) filter (where se = '(연결)현금배당성향(%)')                               as cash_payout_ratio_pct
from picked
group by corp_code, display_year;

comment on view ri_dividends is
  'report_items(item=''배당'', DART alotMatter)의 회사 레벨(stock_knd=''-'') 7항목 wide 파생. '
  'grain=(corp_code, bsns_year). thstrm/frmtrm/lwfr 3개년 중복은 "당해 보고서 thstrm 우선, '
  '2015년 이전만 frmtrm/lwfr 백필"로 병합했다(감독 결정 #2) — bsns_year=2015가 전 회사 '
  'report_items의 최솟값이라 이 조건이 "자기 보고서가 없는 연도만 백필"과 동치임을 호스티드 '
  '실측으로 확인했다. 종류주(보통주/우선주) 레벨 4항목은 ri_dividends_by_class를 본다. '
  '배당락일·지급일은 만들 수 없다 — 원본에 날짜 필드가 없다(설계 문서 §1-C). '
  '★ se 라벨이 시기별로 바뀐 두 항목(별도당기순이익 구라벨 "개별", 연결주당순이익 구라벨 '
  '"주당순이익"·접두 없음)은 IN(...)으로 신구 라벨을 모두 잡는다(20260823000004에서 실측 '
  '확정 — 2016년 이전 vintage 보고서 22,874행이 신 라벨을 안 쓴다). 나머지 5항목은 라벨 '
  '드리프트가 없다(전수 24,629행과 정확히 일치). ★ company_rows CTE는 NOT MATERIALIZED — '
  '3번 참조되는 CTE를 기본값(MATERIALIZED)으로 두면 corp_code 술어가 밀려 못 들어가 '
  'item=''배당'' 전체(368,803행)를 먼저 실체화한다(20260823000003에서 statement_timeout으로 '
  '실측).';

revoke all on ri_dividends from anon, authenticated;
grant select on ri_dividends to service_role;
