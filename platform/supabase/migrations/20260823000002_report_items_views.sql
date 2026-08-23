-- report_items 파생 뷰 6블록 — 직원·타법인출자·배당·소액주주·최대주주·자기주식.
--
-- 설계 근거: 리서치 스크래치패드 `report-items-파생-설계.md`(454줄, 2026-08-23 호스티드
-- 실측). 이 마이그레이션은 그 설계의 §3-1 형태를 그대로 따르되, §4의 미확정 6건은 감독이
-- 아래와 같이 확정한 값을 그대로 반영한다:
--   1. plain VIEW (REBUILD 테이블 아님) — fin_periods(20260806000001)와 비용 구조가 다르다
--      (financial_facts 1,392만 행 EAV 조인이 아니라 report_items 단일 테이블 JSONB 추출,
--      소비 패턴도 종목 상세 화면 하나뿐이라 스크리너 걱정이 없다). 파싱 규칙의 단일 정의는
--      뷰 DDL 자체이고, 여러 뷰가 공유하는 두 규칙(합계행 판별, 일반 숫자 파싱)만 internal
--      스키마 순수 함수(테이블 접근 없음)로 뽑는다.
--   2. 배당 3개년 중복(thstrm/frmtrm/lwfr) — 당해 보고서의 thstrm 우선, 2015년 이전 연도만
--      frmtrm/lwfr로 백필. 호스티드 실측: report_items 배당 최소 bsns_year=2015(전 회사
--      공통) — 즉 2015 미만 연도는 그 어떤 보고서도 자기 자신의 thstrm으로 못 채우고,
--      bsns_year=2015 보고서의 frmtrm(→2014)·lwfr(→2013)로만 도달 가능하다. "2015년 이전만
--      백필"이라는 조건이 바로 이 실측과 맞물려 자연히 성립한다(3부 참고).
--   3. 자기주식 — 총계/총계/총계 리프만 wide 요약. 취득경로별 트리는 정규화하지 않는다
--      (원본은 report_items에 그대로 남아 있어 필요해지면 그때 만든다).
--   4. 평균근속연수 — "N년 M개월"/"N년M월" 전용 파서. 이 정확한 형태에 안 걸리면 NULL
--      (오기·이상값을 억지로 숫자화하지 않는다 — "11월"·"113월"·"10월23일"·"4월 5개월" 같은
--      실측 이상치가 전부 이 규칙으로 NULL이 되는 것을 아래 3부에서 실측 확인했다).
--   5. 최대주주 relate — 원문 그대로 보존. 버킷팅 컬럼을 만들지 않는다(회사마다 다른 자유
--      텍스트라 강제 정규화가 오분류를 만든다 — 설계 문서 §1-D).
--   6. 지분율 정합성(최대주주 '계' + 소액주주 지분 합 ≈ 100%)은 뷰 만든 뒤 실측으로
--      검산하고 보고한다(차단 조건 아님) — 3부 참고.
--
-- ★ 설계 문서 §1-B와의 이탈: 문서는 "타법인출자에 inv_prm='주2)'/'주3)' 같은 순수 각주행이
--   섞여 있다"고 썼으나, 이번 구현 전 재실측(에코프로비엠 전체 연도, 남영나이론 등 각주가
--   실제로 붙은 사례 20건 전수)에서 각주 마커는 항상 실제 피출자법인명에 접두/접미로 붙어
--   있었고("EcoPro BM Hungary Zrt.\n주2)", "주1) 남영나이론(주)") 그 행들은 전부 정상적인
--   비영(非零) 수치를 가진 진짜 데이터 행이었다 — 순수 각주-only 행(`inv_prm` 값이 정확히
--   "주2)" 하나뿐인 행)은 전체 테이블 정규식 스캔(`^주[0-9]*\)`)에서 단 하나도 나오지 않았다.
--   실제로 "값이 없는" 행은 다른 패턴이었다 — `inv_prm='-'`(KONEX류 무투자 회사, 전 수치
--   필드가 "-") 뿐이었다. 그래서 이 뷰는 각주 텍스트를 이름에서 벗겨내려 하지 않고(원문
--   보존 원칙, 오분류 방지) 대신 "합계 라벨"과 "수치 필드가 전부 NULL인 행"만 제외한다 —
--   후자가 실측상 진짜 각주/무의미 행의 유일한 관측 형태였다.

-- ─────────────────────────────────────────────── 0부. internal 순수 함수 3개
--
-- internal 스키마는 20260806000001(fin_periods)이 이미 만들었고 PostgREST 노출 스키마가
-- 아니다(/rpc 표면 없음). service_role은 이미 USAGE를 갖고 있다(실측 확인, 아래 grant는
-- "거부는 두 겹" 원칙에 따른 재확인이 아니라 이 함수들에 대한 신규 EXECUTE 부여다 — 스키마
-- USAGE와 함수 EXECUTE는 별개 권한이라 기존 USAGE가 새 함수의 EXECUTE를 대신하지 않는다).
--
-- 뷰 본문에서 부르는 함수는 뷰 소유자(postgres)가 아니라 **호출자(쿼리를 실제로 던진
-- 역할)의 권한으로 실행된다** — 이는 뷰의 테이블 접근 검사(뷰 소유자 권한으로 수행)와는
-- 별개 메커니즘이다(뷰가 참조하는 릴레이션은 소유자로 치환되지만, 함수 호출은 일반 표현식
-- 평가라 현재 역할의 EXECUTE 권한을 그대로 검사한다). 그래서 PostgREST가 service_role로
-- 뷰를 조회할 때 이 함수들의 EXECUTE가 service_role에 없으면 "permission denied for
-- function" 으로 실패한다 — 아래에서 명시적으로 부여한다.

create or replace function internal.ri_parse_numeric(raw text)
returns numeric
language sql
immutable
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select case
    when raw is null then null
    when trim(raw) in ('-', '') then null
    -- 화이트리스트 [^0-9.\-]: 천단위 콤마·단위 접미사(원/%/명 등)를 제거하면서 부호(-)는
    -- 보존한다. 사전에 '-' 단독 값을 걸러두지 않으면(위 두 번째 when) 하이픈이 화이트리스트
    -- 안에 있어 regexp_replace가 지우지 못하고 '-'::numeric 캐스팅에서 에러가 난다 —
    -- 설계 문서 §3-3에서 직접 테스트로 확인된 함정.
    else nullif(regexp_replace(raw, '[^0-9.\-]', '', 'g'), '')::numeric
  end
$$;

comment on function internal.ri_parse_numeric(text) is
  'report_items payload의 콤마 천단위·부호·%/원/명 등 단위 접미사가 섞인 숫자 문자열을 '
  'numeric으로 정리한다. "-"(결측 표기)와 빈 문자열은 NULL. 콤마 안의 음수 부호는 보존한다 '
  '(예: "-121,559,000,000" → -121559000000). 이 레포의 유일한 정의처 — 각 뷰가 이 함수를 '
  '호출할 뿐 자체 정규식을 반복하지 않는다.';

create or replace function internal.ri_is_total_label(raw text)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select trim(coalesce(raw, '')) in ('계', '총계', '합계')
$$;

comment on function internal.ri_is_total_label(text) is
  '최대주주(nm=''계'')·타법인출자(inv_prm=''합계'')·자기주식(acqs_mth1/2/3=''총계'') 세 블록이 '
  '공유하는 합계행 라벨 판정. 직원 블록의 "성별합계"/"성별 합계"는 이 집합에 걸리지 않는다 — '
  '부분일치이고 공백 유무가 흔들려서(설계 문서 §1-A) ri_employees 뷰가 별도 규칙으로 처리한다, '
  '100% 공용화는 안 된다(설계 문서 §3-3).';

create or replace function internal.ri_parse_tenure_years(raw text)
returns numeric
language sql
immutable
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select case
    when raw is null then null
    when trim(raw) in ('-', '') then null
    -- 이미 순수 소수(단위 없음) — 1000행 표본(설계 문서 §1-A)에서 78.1%가 이 경로.
    when raw ~ '^\s*[0-9]+(\.[0-9]+)?\s*$'
      then trim(raw)::numeric
    -- "N년 M개월"/"N년M월"/"N년" 전용 — 전체 문자열이 이 형태와 정확히 일치할 때만 계산한다.
    -- 실측 이상치(아래 주석)는 전부 이 정규식에 안 걸려 NULL로 떨어진다 — 오기를 억지로
    -- 숫자화하지 않는다는 감독 결정(설계 문서 §4-4)을 정확히 구현한다.
    when raw ~ '^\s*[0-9]+\s*년\s*([0-9]+\s*(개월|월)\s*)?$'
      then (regexp_match(raw, '^\s*([0-9]+)\s*년'))[1]::numeric
         + coalesce((regexp_match(raw, '([0-9]+)\s*(?:개월|월)'))[1]::numeric, 0) / 12.0
    else null
  end
$$;

comment on function internal.ri_parse_tenure_years(text) is
  'avrg_cnwk_sdytrn(평균근속연수) 전용 파서. 일반 숫자 규칙(ri_parse_numeric)을 쓰면 '
  '"8년 4개월"이 콤마 화이트리스트를 통과해 "84"로 뭉개진다 — 두 숫자 그룹을 따로 뽑아 '
  '년+개월/12로 계산해야 한다. "N년 (M개월|M월)" 전체 일치가 아니면 NULL — 호스티드 실측:'
  ' "11월"(년 없음)·"113월"(오기)·"10월23일"(날짜 형식 오염)·"4월 5개월"(년 자리에 월이 '
  '들어간 오기) 전부 이 규칙에서 NULL로 떨어짐을 확인했다. 100% 커버가 목적이 아니다 — '
  'fin_periods의 EBITDA 커버리지(33.7%)처럼 "정직하게 실패를 인정하는" 필드다.';

revoke all on function internal.ri_parse_numeric(text)      from public;
revoke all on function internal.ri_is_total_label(text)     from public;
revoke all on function internal.ri_parse_tenure_years(text) from public;
grant execute on function internal.ri_parse_numeric(text)      to service_role;
grant execute on function internal.ri_is_total_label(text)     to service_role;
grant execute on function internal.ri_parse_tenure_years(text) to service_role;

-- ─────────────────────────────────────────────── 1부. 직원 (long, grain=corp,year,부문,성별)
--
-- "회사 전체 합계" 행(직원 item에서만 "성별합계"/"성별 합계")은 있는 회사도 없는 회사도
-- 있다(설계 문서 §1-A) — 그래서 여기서 제외하지 않고 is_total_row로 플래그만 남긴다.
-- 화면이 있으면 그 행을 "합계" 줄로 쓰고, 없으면 sum(...) where not is_total_row로 즉석
-- 합산해야 한다(설계 문서 §3-6) — 그 분기는 뷰가 아니라 화면 렌더 시점의 몫이다.
create view ri_employees as
select
  corp_code,
  bsns_year,
  rcept_no,
  payload->>'stlm_dt' as stlm_dt,
  -- fo_bbm(부문명)의 앞뒤/내부 공백이 흔들린다(" 전주1 ", "기   타") — trim 후 연속 공백을
  -- 한 칸으로 정규화한다(설계 문서 §1-A, group by 전 필수 규칙).
  regexp_replace(trim(payload->>'fo_bbm'), '\s+', ' ', 'g') as department,
  payload->>'sexdstn' as gender,
  -- 합계행 판정은 공백을 전부 제거하고 비교한다 — "성별합계"와 "성별 합계"가 같은 개념임을
  -- 확인하려면 내부 공백 한 칸짜리 정규화로는 부족하고(둘이 여전히 다른 문자열) 완전 제거가
  -- 필요하다(설계 문서 §3-3).
  regexp_replace(trim(payload->>'fo_bbm'), '\s+', '', 'g') = '성별합계' as is_total_row,
  internal.ri_parse_numeric(payload->>'sm')         as headcount_total,
  internal.ri_parse_numeric(payload->>'rgllbr_co')  as headcount_regular,
  internal.ri_parse_numeric(payload->>'cnttk_co')   as headcount_contract,
  internal.ri_parse_tenure_years(payload->>'avrg_cnwk_sdytrn') as avg_tenure_years,
  payload->>'avrg_cnwk_sdytrn' as avg_tenure_years_raw,
  internal.ri_parse_numeric(payload->>'jan_salary_am')      as avg_annual_salary,
  internal.ri_parse_numeric(payload->>'fyer_salary_totamt') as total_salary_amount,
  nullif(trim(payload->>'rm'), '-') as note
from report_items
where item = '직원';

comment on view ri_employees is
  'report_items(item=''직원'', DART empSttus)의 부문×성별 파생. grain=(corp_code, bsns_year, '
  'department, gender) — 부문 개수가 회사마다 1~4+개로 다르므로 wide 컬럼화가 불가능하다 '
  '(설계 문서 §1-A/§3-1). "회사 전체 합계" 행의 유무가 회사마다 갈리므로 여기서 제외하지 '
  '않고 is_total_row로만 표시한다 — 합산은 화면 렌더 시점의 책임이다.';
comment on column ri_employees.avg_tenure_years is
  'internal.ri_parse_tenure_years 결과. "N년 M개월" 전용 파싱, 실패는 NULL — 100% 커버 '
  '아님(정확한 오염 비율은 확인 불가, 함수 주석 참고). 원문이 필요하면 '
  'avg_tenure_years_raw를 본다.';
comment on column ri_employees.is_total_row is
  '부문명이 공백 제거 후 "성별합계"와 일치하는 행. 있는 회사도 없는 회사도 있다 — '
  '이 값의 부재가 곧 "회사 합계가 없다"는 뜻은 아니고, 그 회사가 이 라벨로 합계행을 '
  '보내지 않았다는 뜻이다.';

revoke all on ri_employees from anon, authenticated;
grant select on ri_employees to service_role;

-- ─────────────────────────────────────────────── 2부. 타법인출자 (long, grain=corp,year,투자처)
--
-- 합계행("합계")과, 수치 필드가 전부 NULL인 행(무투자 회사의 "-" 더미 — KONEX류)을
-- 제외한다. 위 서문에서 밝힌 대로 "각주만 있는 행"은 실측상 존재하지 않았고(각주 마커는
-- 항상 실제 투자처명에 붙어 있다), 그 자리를 실제로 차지하는 무의미 행은 이 "전부 NULL"
-- 패턴이다 — having 절로 걸러진다(설계 문서 §3-6 권고 그대로).
create view ri_investments as
with parsed as (
  select
    corp_code,
    bsns_year,
    rcept_no,
    payload->>'stlm_dt' as stlm_dt,
    -- 원문 그대로 보존 — 각주 마커("주2)")가 이름에 붙어 있어도 벗겨내지 않는다. 벗겨낼
    -- 안전한 규칙이 없다(회사마다 위치가 다르고, 접두/접미가 섞인다) — 설계 문서 §1-B.
    payload->>'inv_prm' as investee_name,
    payload->>'invstmnt_purps' as purpose,
    case when payload->>'frst_acqs_de' ~ '^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$'
         then to_date(payload->>'frst_acqs_de', 'YYYY.MM.DD')
    end as first_acquired_on,
    internal.ri_parse_numeric(payload->>'frst_acqs_amount')                          as first_acquired_amount,
    internal.ri_parse_numeric(payload->>'bsis_blce_qy')                              as shares_beginning,
    internal.ri_parse_numeric(payload->>'trmend_blce_qy')                            as shares_ending,
    internal.ri_parse_numeric(payload->>'bsis_blce_qota_rt')                         as stake_pct_beginning,
    internal.ri_parse_numeric(payload->>'trmend_blce_qota_rt')                       as stake_pct_ending,
    internal.ri_parse_numeric(payload->>'bsis_blce_acntbk_amount')                   as book_value_beginning,
    internal.ri_parse_numeric(payload->>'trmend_blce_acntbk_amount')                 as book_value_ending,
    internal.ri_parse_numeric(payload->>'incrs_dcrs_acqs_dsps_qy')                   as change_shares,
    internal.ri_parse_numeric(payload->>'incrs_dcrs_acqs_dsps_amount')               as change_amount,
    internal.ri_parse_numeric(payload->>'incrs_dcrs_evl_lstmn')                      as valuation_gain_loss,
    internal.ri_parse_numeric(payload->>'recent_bsns_year_fnnr_sttus_tot_assets')    as investee_total_assets,
    internal.ri_parse_numeric(payload->>'recent_bsns_year_fnnr_sttus_thstrm_ntpf')   as investee_net_income
  from report_items
  where item = '타법인출자'
    and not internal.ri_is_total_label(payload->>'inv_prm')
)
select *
from parsed
where coalesce(
  first_acquired_amount, shares_beginning, shares_ending, stake_pct_beginning,
  stake_pct_ending, book_value_beginning, book_value_ending, change_shares,
  change_amount, valuation_gain_loss, investee_total_assets, investee_net_income
) is not null;

comment on view ri_investments is
  'report_items(item=''타법인출자'', DART otrCprInvstmntSttus)의 투자처별 파생. '
  'grain=(corp_code, bsns_year, investee_name) — 투자처 개수가 회사마다 3~147개로 다르므로 '
  'wide 컬럼화가 불가능하다(설계 문서 §1-B/§3-1). "합계" 라벨 행과, 수치 필드가 전부 NULL인 '
  '무투자 더미 행("-")을 제외한다. 각주 마커가 붙은 투자처명은 원문 그대로 남긴다 — 이름 '
  '패턴으로 안전하게 벗겨낼 근거가 없다(마이그레이션 서문 참고).';
comment on column ri_investments.investee_name is
  '원문 보존. 각주 마커가 접두("주1) 남영나이론(주)") 또는 접미("EcoPro BM Hungary '
  'Zrt.\n주2)")로 섞여 들어올 수 있다 — 실측상 이 마커가 붙은 행도 전부 실제 수치를 가진 '
  '진짜 투자처 행이었다(순수 각주-only 행은 관측되지 않음).';

revoke all on ri_investments from anon, authenticated;
grant select on ri_investments to service_role;

-- ─────────────────────────────────────────────── 3부. 배당 (wide, 회사 레벨 + 종류주 레벨)
--
-- 배당 item은 고정 15행 템플릿(se 7종 × stock_knd=''-'' + se 4종 × stock_knd∈{보통주,우선주,
-- 종류주식})이다(설계 문서 §1-C, 호스티드 실측으로 15개 se 라벨 전수 재확인). 값 컬럼
-- thstrm/frmtrm/lwfr이 한 보고서에 3개년을 담아온다 — 감독 결정 #2: 당해 연도는 그 해 자기
-- 보고서의 thstrm을 우선하고, report_items가 아예 못 미치는 2015년 이전 연도만 더 최근
-- 보고서의 frmtrm/lwfr로 채운다. bsns_year=2015가 report_items의 최소값(전 회사 공통,
-- 호스티드 실측)이므로 "2015년 이전만 백필"은 "자기 보고서가 없는 연도만 백필"과 정확히
-- 같은 뜻이 된다 — 2016년 이후 보고서의 frmtrm/lwfr은 항상 이미 자기 thstrm을 가진 연도를
-- 가리키므로 이 필터에 걸러진다.
--
-- 회사 레벨 7항목(주당액면가액·연결/별도당기순이익·연결주당순이익·현금배당금총액·
-- 주식배당금총액·연결현금배당성향)은 ri_dividends, 종류주 레벨 4항목(현금배당수익률·
-- 주식배당수익률·주당현금배당금·주당주식배당)은 ri_dividends_by_class — 설계 문서 §3-1이
-- 명시한 "두 테이블" 그대로.
create view ri_dividends as
with company_rows as (
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
  '배당락일·지급일은 만들 수 없다 — 원본에 날짜 필드가 없다(설계 문서 §1-C).';

revoke all on ri_dividends from anon, authenticated;
grant select on ri_dividends to service_role;

create view ri_dividends_by_class as
with class_rows as (
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
  -- 원문 그대로 노출 — 회사마다 "우선주" 또는 "종류주식"으로 갈린다(고정 enum 아님,
  -- 설계 문서 §1-C).
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
  'ri_dividends와 동일(당해 우선, 2015년 이전만 백필).';

revoke all on ri_dividends_by_class from anon, authenticated;
grant select on ri_dividends_by_class to service_role;

-- ─────────────────────────────────────────────── 4부. 소액주주 (wide, grain=corp,year)
--
-- 회사당 정확히 1행(설계 문서 §1-D, 5개 표본 전수 확인)이지만, 정정공시 등으로 같은
-- (corp,item,bsns_year)에 rcept_no가 둘 이상 생기는 경우를 방어적으로 대비해
-- distinct on + rcept_no desc(최신 공시 우선)로 grain을 강제한다.
create view ri_minority_shareholders as
select distinct on (corp_code, bsns_year)
  corp_code,
  bsns_year,
  rcept_no,
  payload->>'stlm_dt' as stlm_dt,
  internal.ri_parse_numeric(payload->>'shrholdr_co')     as minority_shareholder_count,
  internal.ri_parse_numeric(payload->>'shrholdr_tot_co') as total_shareholder_count,
  -- shrholdr_rate/hold_stock_rate는 이 item에서만 값 문자열 안에 "%"가 붙는다
  -- ("99.99%") — ri_parse_numeric의 화이트리스트가 "%"를 자동으로 제거한다.
  internal.ri_parse_numeric(payload->>'shrholdr_rate')   as minority_shareholder_ratio_pct,
  internal.ri_parse_numeric(payload->>'hold_stock_co')   as minority_shares_held,
  internal.ri_parse_numeric(payload->>'hold_stock_rate') as minority_shares_ratio_pct,
  internal.ri_parse_numeric(payload->>'stock_tot_co')    as total_shares_issued
from report_items
where item = '소액주주'
order by corp_code, bsns_year, rcept_no desc;

comment on view ri_minority_shareholders is
  'report_items(item=''소액주주'', DART mrhlSttus)의 wide 파생. grain=(corp_code, '
  'bsns_year), 항상 1행(설계 문서 §1-D). shrholdr_rate/hold_stock_rate 원본 문자열에 "%"가 '
  '포함되어 있었다 — 다른 블록의 지분율 필드(예: 최대주주)는 "%" 없는 순수 숫자라 이 필드가 '
  '유일한 예외다(설계 문서 §2).';

revoke all on ri_minority_shareholders from anon, authenticated;
grant select on ri_minority_shareholders to service_role;

-- ─────────────────────────────────────────────── 5부. 최대주주 (long, grain=corp,year,주주,주식종류)
--
-- relate(관계)는 회사마다 완전히 다른 자유 텍스트다(삼성전자: "최대주주 본인"/"최대주주의
-- 특수관계인"/"계열회사 임원"/"계열회사"/"출연 재단", KONEX 태양3C: "최대주주"/"임원"/
-- "본인"/"배우자"/"자녀"/"형제"/"처남"/"장인") — 감독 결정 #5: 버킷팅 컬럼을 만들지 않고
-- 원문을 그대로 노출한다. "계"(합계) 행도 제외하지 않고 is_total_row로만 표시한다 —
-- 직원과 같은 이유(설계 문서 §3-6은 UI 단 제외를 권했지만, 이 행이 바로 결정 #6의 지분율
-- 정합성 검산 입력이라 뷰 단계에서 지워버리면 그 검산을 뷰만으로 재현할 수 없게 된다).
create view ri_major_shareholders as
select
  corp_code,
  bsns_year,
  rcept_no,
  payload->>'stlm_dt' as stlm_dt,
  -- 원문 그대로 — 개행이 섞인 값도 있다("삼성생명보험㈜\n(특별계정)", 설계 문서 §1-D).
  payload->>'nm' as shareholder_name,
  payload->>'relate' as relate,
  payload->>'stock_knd' as stock_knd,
  internal.ri_parse_numeric(payload->>'bsis_posesn_stock_co')      as shares_beginning,
  internal.ri_parse_numeric(payload->>'trmend_posesn_stock_co')    as shares_ending,
  internal.ri_parse_numeric(payload->>'bsis_posesn_stock_qota_rt') as stake_pct_beginning,
  internal.ri_parse_numeric(payload->>'trmend_posesn_stock_qota_rt') as stake_pct_ending,
  nullif(trim(payload->>'rm'), '-') as note,
  internal.ri_is_total_label(payload->>'nm') as is_total_row
from report_items
where item = '최대주주';

comment on view ri_major_shareholders is
  'report_items(item=''최대주주'', DART hyslrSttus)의 주주별 파생 — 최대주주 본인 + '
  '특수관계인 리스트다. grain=(corp_code, bsns_year, shareholder_name, stock_knd). '
  'relate는 원문 그대로 노출한다 — 회사마다 어휘가 완전히 다른 자유 텍스트라 강제 '
  '정규화(버킷팅)가 오분류를 만든다(감독 결정 #5). is_total_row=true인 "계" 행은 지분율 '
  '정합성 검산(마이그레이션 서문 결정 #6)의 입력이라 제외하지 않는다. FnGuide의 "5%이상 '
  '주주"·"임원 지분" 표는 이 뷰만으로 재구성되지 않는다 — 특수관계 없는 5%+ 주주·전문경영인 '
  '임원은 이 개념(hyslrSttus) 자체가 다루지 않는 스코프다(설계 문서 §3-5, ownership_txns의 '
  '사건 스트림에서 별도로 재구성해야 함).';

revoke all on ri_major_shareholders from anon, authenticated;
grant select on ri_major_shareholders to service_role;

-- ─────────────────────────────────────────────── 6부. 자기주식 요약 (wide, grain=corp,year)
--
-- 자기주식은 18행 고정 트리(대분류×중분류×소분류 9리프 × 보통주/우선주)이지만 화면에
-- 필요한 숫자는 총계/총계/총계 리프뿐이다(감독 결정 #3: 트리 정규화 안 함, 원본은
-- report_items에 그대로 남는다). 주식종류(stock_knd)는 자기주식에서는 실측상 보통주/우선주
-- 둘로 안정적이라(설계 문서에서 종류주식 변형이 보고되지 않음) 두 클래스를 컬럼으로 편다 —
-- 최대주주의 relate처럼 회사마다 흔들리는 자유 텍스트가 아니다.
create view ri_treasury_stock_summary as
with total_rows as (
  select
    corp_code, bsns_year, rcept_no,
    payload->>'stlm_dt' as stlm_dt,
    trim(payload->>'stock_knd') as stock_knd,
    internal.ri_parse_numeric(payload->>'bsis_qy')        as bsis_qy,
    internal.ri_parse_numeric(payload->>'trmend_qy')      as trmend_qy,
    internal.ri_parse_numeric(payload->>'change_qy_acqs') as change_qy_acqs,
    internal.ri_parse_numeric(payload->>'change_qy_dsps') as change_qy_dsps,
    internal.ri_parse_numeric(payload->>'change_qy_incnr') as change_qy_incnr
  from report_items
  where item = '자기주식'
    and trim(payload->>'acqs_mth1') = '총계'
    and trim(payload->>'acqs_mth2') = '총계'
    and trim(payload->>'acqs_mth3') = '총계'
)
select
  corp_code,
  bsns_year,
  max(rcept_no) as rcept_no,
  max(stlm_dt)  as stlm_dt,
  max(trmend_qy)       filter (where stock_knd = '보통주') as common_shares_ending,
  max(bsis_qy)         filter (where stock_knd = '보통주') as common_shares_beginning,
  max(change_qy_acqs)  filter (where stock_knd = '보통주') as common_shares_acquired,
  max(change_qy_dsps)  filter (where stock_knd = '보통주') as common_shares_disposed,
  max(change_qy_incnr) filter (where stock_knd = '보통주') as common_shares_incinerated,
  max(trmend_qy)       filter (where stock_knd = '우선주') as preferred_shares_ending,
  max(bsis_qy)         filter (where stock_knd = '우선주') as preferred_shares_beginning,
  max(change_qy_acqs)  filter (where stock_knd = '우선주') as preferred_shares_acquired,
  max(change_qy_dsps)  filter (where stock_knd = '우선주') as preferred_shares_disposed,
  max(change_qy_incnr) filter (where stock_knd = '우선주') as preferred_shares_incinerated
from total_rows
group by corp_code, bsns_year;

comment on view ri_treasury_stock_summary is
  'report_items(item=''자기주식'', DART tesstkAcqsDspsSttus)의 총계 리프(acqs_mth1/2/3 = '
  '''총계'') 요약 wide 파생. grain=(corp_code, bsns_year). 취득 경로별(배당가능이익범위 이내 '
  '취득/기타취득 등) 세부 트리는 정규화하지 않는다(감독 결정 #3) — 필요해지면 원본 '
  'report_items에서 별도로 만든다. 보통주/우선주 컬럼으로 폈다 — 이 item의 stock_knd는 '
  '최대주주의 relate와 달리 회사마다 흔들리는 자유 텍스트가 아니다.';

revoke all on ri_treasury_stock_summary from anon, authenticated;
grant select on ri_treasury_stock_summary to service_role;

-- ─────────────────────────────────────────────── 7부. 인덱스 — 필요 없음
--
-- 7개 뷰 전부 기반 쿼리가 `where item = '<고정값>'`을 뷰 정의 안에 갖고, 소비 패턴은
-- "이 종목의, 이 블록의, 여러 연도"(where corp_code = $1)뿐이다(설계 문서 §3-6). 기존
-- report_items의 ri_lookup 인덱스 (corp_code, item, bsns_year)가 이미 선행 두 컬럼을
-- 커버하므로 추가 인덱스가 필요 없다 — fin_periods의 fp_period 같은 스크리너용 인덱스는
-- 지금 요구사항(종목 상세 화면)에 대응물이 없다.
