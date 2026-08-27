-- fin_periods 확장 — CAPEX·이자비용·이자보상배율 추가.
--
-- 배경: 화면이 CAPEX 대리로 cf_investing(투자활동 총액)을 쓰는데 실제 CAPEX의 1.4배
-- 과대다(삼성 2025: cf_investing -685,122억 vs 유형자산의취득 475,222억). CAPEX는
-- financial_facts 본표 CF(sj_div='CF')에 이미 있다 — 추출 불필요, 개념만 추가하면 된다.
-- 이자비용은 파일럿으로 sj_div='NOTE' 행이 생겼다(삼성 1개사 2025 만, 605,783,000,000원).
-- 금융업은 본표 IS에 ifrs-full_InterestExpense로 이미 있다. 이 마이그레이션은 두 개념을
-- 추가하고 파생으로 이자보상배율(interest_coverage)을 계산한다.
--
-- 실측(2026-08-25, 호스티드 financial_facts 13,920,065행 대상, 마이그레이션 작성 전 읽기전용
-- 조사, DB 미변경):
--
-- ─────────────────────────────────────────────── CAPEX 실측
--
-- 계정명 변형: sj_div='CF' AND account_nm like '%유형자산%취득%' 전수 스캔 결과, 압도적
-- 다수가 표준계정코드 ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities
-- (2,337사) 와 구택소노미 ifrs_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities
-- (1,519사) 두 태그에 몰려 있다. dart_PurchaseOfOtherPropertyPlantAndEquipment("기타유형자산의
-- 취득", 217사)도 같은 성격의 실질 취득액이라 alt로 포함한다. '-표준계정코드 미사용-' 낙폭
-- (449사, "유형자산의 취득")은 공백·마침표·"및 투자부동산" 등 표기 변형이 섞여 있어
-- name_alts 12종으로 흡수한다(아래 삽입문).
--   회사 단위 커버리지: CF 사실이 하나라도 있는 2,659사 중 2,496사(93.87%) 매칭 —
--   기존 개념들(현금 100%·판관비 94.5%)과 같은 급.
--
-- 부호 관례: 압도적 다수(2,458사, 70,274행)가 양수로 적재돼 있으나 213사(619행)는 음수다.
-- 더 중요한 건 **같은 회사 안에서도 갈린다** — 199사가 어떤 연도는 양수, 어떤 연도는
-- 음수로 적재돼 있다(회사 단위 부호 일관성이 없다). abs() 정규화가 필요하다 — 아래
-- account_concepts.normalize_abs 컬럼으로 표현한다(부호 정규화도 is_stock처럼 "개념의
-- 성질"이라 사실이 아니라 개념 테이블에 둔다).
--
-- 여러 행이 한 개념에 매칭되는 비율: 위 정의(account_id 3종 + name_alts 12종) 전체를
-- (corp,연도,reprt_code,fs_div) 로 묶으면 77,580개 스코프 중 533개(0.69%)가 한 스코프에
-- 서로 다른 금액의 행 2개 이상을 갖는다. 기존 depreciation의 8.8%보다 낮은 급이라
-- **기존 9개 개념과 동일하게 max(amount)로 하나를 고른다** — sum은 채택하지 않는다.
-- 회사 하나(00126380 삼성전자)로 표준 태그 하나(ifrs-full_.../ifrs_...)만 좁혀서 다시
-- 재면 0.00%(67,964개 스코프, 중복 0)라 진짜 원인은 "기타유형자산의 취득" 같은 별도
-- 하위 항목을 합산해야 하는 경우이지 같은 사실의 이중 태깅이 아니다 — max를 쓰면 그
-- 하위 항목 중 큰 쪽만 남고 작은 쪽이 버려지는 게 known gap이다(전체의 0.69%뿐이라
-- 감수한다).
--
-- 건설중인유형자산의 취득(dart_PurchaseOfConstructionInProgress, CIP)은 **넣지 않았다.**
-- 74,366개 스코프 중 6,777개(9.1%)가 CIP를 갖고 그중 5,510개(7.4%)는 일반 취득액 없이
-- CIP만 있다 — CIP를 포함하면 실질적 총 설비투자 커버리지는 올라가지만, 과제가 준
-- 검증 기준값(삼성 2023~2025: 576,113/514,064/475,222억)이 정확히 "유형자산의 취득"
-- 단일 라인이고(삼성은 CIP 라인 자체가 없다 — 전 연도 확인) 재무상태표상 완성 유형자산과
-- 건설중자산은 다른 자산 항목이라 지금 넣으면 검증 불가능한 정의 확장이 된다. 알려진
-- 공백으로 남긴다(CIP로만 설비투자하는 7.4%는 capex가 NULL이 된다).
--
-- amount_cum(reprt_code=11014 누적) 커버리지: **0.00%**(전 reprt_code, 전 20,748~18,812행에서
-- 단 하나도 없음) — cf_operating/cf_investing/cf_financing과 똑같은 결함이다(20260823000005가
-- 이미 고친 그 문제). 그래서 capex도 Q4 = 연간 − (Q1+Q2+Q3 단독합) 경로를 그 셋과 함께 쓴다
-- (아래 3부, 기존 하드코딩 리스트에 'capex' 추가 — 새 컬럼을 만들지 않고 기존 패턴 그대로
-- 확장한다. is_stock/normalize_abs/sj_div_exclude 와 달리 이건 20260823000005 가 이미
-- "이름으로 나열"하는 방식을 썼으므로 그 패턴을 유지한다).
--
-- ─────────────────────────────────────────────── 이자비용 실측 — 매칭 안전성
--
-- ★ 위험 발견: account_id='ifrs-full_InterestExpense' 또는 'dart_InterestExpenseFinanceExpense'
-- 가 IS/CIS(발생주의 이자비용)뿐 아니라 **CF에도 같은 account_id로 나타난다**(예:
-- ifrs-full_InterestExpense/"이자비용 지급" 2사, dart_InterestExpenseFinanceExpense/
-- "이자비용(금융원가)" 3사 — CF 섹션인데 IS와 같은 표준코드를 쓴 케이스). rebuild의 f
-- CTE는 sj_div를 전혀 보지 않고 매칭하므로, 이 상태로 넣으면 agg의 max(amount)가 IS
-- 발생주의 값과 CF 현금 값 중 큰 쪽을 무작위로 고른다.
-- name_alts 경로도 같은 위험이 실측으로 확인됐다: account_id='-표준계정코드 미사용-' AND
-- account_nm='이자비용'인 행이 **CF에 191사(1,589행), CIS에 27사(194행), IS에 3사(55행)** —
-- CF 쪽이 압도적으로 많다. sj_div 가드 없이 이름만 맞으면 진짜 위험한 조합이다(과제가 예시로
-- 든 "이자의 지급" 오매칭과는 다른 경로지만 같은 종류의 사고 — 같은 이름/코드가 현금흐름표와
-- 손익계산서 양쪽에 동시에 존재).
--   실측 영향: sj_div 가드 없이 넣으면 513개사가 매칭되지만 그중 229개사(44.6%)가 CF
--   행으로 오염된다. 가드를 걸면 322개사만 안전하게 남는다.
-- **설계로 막는다**: account_concepts에 sj_div_exclude 컬럼을 추가하고 interest_expense에
-- array['CF']를 준다 — f CTE의 WHERE에 `not (ff.sj_div = any(ac.sj_div_exclude))`를 추가해
-- CF 사실 자체를 이 개념의 후보에서 구조적으로 뺀다. 빈 배열(기본값)인 기존 9+10개 개념은
-- 동작이 전혀 바뀌지 않는다(빈 배열에 대한 `x = any('{}')`는 x가 NULL이어도 항상 false이므로
-- `not false`=true로 전부 통과 — PostgreSQL의 빈 배열 ANY 특성).
--
-- 삼성 파일럿 재확인: sj_div='NOTE', account_id='-표준계정코드 미사용-',
-- account_nm='이자비용(금융원가)', amount=605,783,000,000(=6,057.83억, bsns_year=2025 만).
-- name_alts에 '이자비용(금융원가)'과 '이자비용'(CIS/IS에서만 유효, CF는 가드로 차단)을 넣는다.
--
-- 커버리지(sj_div<>'CF' 가드 적용 후): 322개사. 낮은 편이지만 이 데이터셋의 구조적 한계다
-- (fnguide-재무제표-계정체계.md 실측: 대형 비금융사 4곳은 본표·주석 어디에도 이자비용
-- 단독 계정이 없다 — 이 파일럿 NOTE 확장이 커질수록 자연히 늘어난다).
--
-- 부호: sj_div<>'CF' 범위에서도 322사 중 34사(119행)가 음수, 그중 30사는 회사 안에서도
-- 양/음이 섞인다 — capex와 같은 이유로 normalize_abs=true를 준다(이자보상배율이 회사마다
-- 부호로 뒤집히는 것을 막는다).

-- ─────────────────────────────────────────────── 1부. account_concepts 확장

alter table account_concepts
  add column if not exists sj_div_exclude text[] not null default '{}',
  add column if not exists normalize_abs  boolean not null default false;

comment on column account_concepts.sj_div_exclude is
  '이 개념의 매칭에서 제외할 sj_div 목록. 기본 빈 배열(제외 없음). interest_expense 는 CF 를
  제외한다 — 같은 account_id/account_nm(ifrs-full_InterestExpense, dart_InterestExpenseFinanceExpense,
  "이자비용")이 IS/CIS(발생주의)뿐 아니라 CF(현금 지급·조정)에도 나타나, sj_div 없이 max(amount)로
  고르면 현금 값과 발생주의 값이 섞인다(2026-08-25 실측: 가드 없이 513개사 매칭 중 229개사가
  CF 행으로 오염, 가드 적용 시 322개사로 안전하게 좁혀짐). 빈 배열이면 동작이 기존과 완전히
  같다(PostgreSQL 에서 `x = any(빈배열)` 은 x 가 NULL 이어도 항상 false).';

comment on column account_concepts.normalize_abs is
  'true 면 f CTE 에서 abs(amount) 로 정규화한다. capex·interest_expense 는 회사마다(심지어
  같은 회사가 연도마다) 양수/음수로 뒤섞여 적재돼 있다(2026-08-25 실측: capex 199개사,
  interest_expense 30개사가 회사 내부에서도 부호가 갈림) — 정규화하지 않으면 파생 비율
  (interest_coverage 등)의 부호가 회사마다 뒤집힌다.';

insert into account_concepts (concept, label, account_id, account_id_alts, name_alts, is_stock, sj_div_exclude, normalize_abs) values
  ('capex', '유형자산의 취득(CAPEX)',
     'ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities',
     array['ifrs_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities',
           'dart_PurchaseOfOtherPropertyPlantAndEquipment'],
     array['유형자산의 취득','유형자산의취득','유형자산 취득','유형자산취득',
           '유형자산의  취득','유형자산의 취득.',
           '유형자산 및 투자부동산의 취득','유형자산및투자부동산의 취득',
           '기타유형자산의 취득','기타의유형자산의 취득','기타의유형자산의취득','기타유형자산의 증가'],
     false, '{}', true),
  ('interest_expense', '이자비용', 'ifrs-full_InterestExpense',
     array['dart_InterestExpenseFinanceExpense'],
     array['이자비용','이자비용(금융원가)'],
     false, array['CF'], true)
on conflict (concept) do nothing;

-- ─────────────────────────────────────────────── 2부. fin_periods 컬럼 3개 추가

alter table fin_periods
  add column if not exists capex              numeric,
  add column if not exists interest_expense   numeric,
  add column if not exists interest_coverage  numeric;

comment on column fin_periods.capex is
  '유형자산의 취득(CAPEX, 현금흐름표 투자활동). abs() 로 양수 정규화(2026-08-25 실측: 회사마다
  부호가 갈림). cf_investing(투자활동 현금흐름 총액)과 다르다 — cf_investing 은 capex 외에
  금융자산 취득·처분 등을 포함한 순액이라 삼성 2025 기준 1.4배 과대(-685,122억 vs
  475,222억). amount_cum 커버리지가 0%라 Q4/TTM 은 cf_operating/investing/financing 과
  같은 경로(분기 단독값 3개의 합으로 역산)를 쓴다. 건설중인유형자산의 취득(CIP)은 포함하지
  않는다 — 알려진 공백(마이그레이션 코멘트 참고), CIP 로만 설비투자하는 회사(약 7.4%)는
  NULL 이 된다.';
comment on column fin_periods.interest_expense is
  '이자비용(발생주의). 금융업은 본표 IS 의 ifrs-full_InterestExpense/dart_InterestExpenseFinanceExpense
  로 채워지고(322개사 커버), 비금융 대형사는 주석(NOTE) 추출이 확장되는 만큼만 채워진다(현재
  삼성전자 2025 만 파일럿 적재됨 — 2022~2024 는 NULL 이 정상). sj_div=''CF'' 는 매칭에서
  구조적으로 제외한다(account_concepts.sj_div_exclude 코멘트 참고) — 같은 계정명·코드가
  현금흐름표의 "이자의 지급"류 현금 지급액으로도 존재해 오매칭 위험이 실측으로 확인됐다.
  abs() 로 양수 정규화.';
comment on column fin_periods.interest_coverage is
  '이자보상배율 = operating_income / interest_expense (배수, %가 아니다 — _pct 접미 없음).
  interest_expense 가 0 이거나 NULL 이면 NULL. interest_expense 컬럼과 같은 커버리지 한계를
  그대로 물려받는다 — 이 데이터셋에서 대형 비금융사 대부분은 구조적으로 계산 불가능하다.';

-- ─────────────────────────────────────────────── 3부. fin_periods_rebuild 전체 교체
--
-- 20260823000005 원본에서 바뀐 지점만 표시한다.
--   (1) f CTE — sj_div_exclude 가드 추가, normalize_abs 로 amount 부호 정규화.
--   (2) base CTE — Q4 특례 리스트에 'capex' 추가(cf_operating/investing/financing 과 같은
--       amount_cum 결손이 capex 에도 있다 — 위 실측 참고). 새 컬럼을 만들지 않고
--       20260823000005 가 이미 쓴 "이름으로 나열" 패턴을 그대로 확장한다.
--   (3) p CTE — capex, interest_expense max(v) 필터 추가.
--   (4) d CTE — interest_coverage 파생 추가.
--   (5) INSERT 컬럼 목록·최종 SELECT — 기존 45개 컬럼 전부 보존 + 신규 3개(capex,
--       interest_expense, interest_coverage) 끝에 추가. 순서·표현식 모두 원본과 동일—
--       diff 로 기계 검증 완료(마이그레이션 파일 커밋 메시지 참고).

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
    current_assets, current_liabilities, inventories,
    capital_stock, retained_earnings, capital_surplus,
    capex, interest_expense,
    gpm_pct, opm_pct, npm_pct, roe_pct, debt_ratio_pct,
    current_ratio_pct, quick_ratio_pct, reserve_ratio_pct, equity_ratio_pct,
    interest_coverage
  )
  -- f: 개념 단위 사실. 조인 조건은 financial_metrics 뷰와 **글자 그대로 같다** —
  --    같아야 annual_summary 와의 교차검증이 성립한다. sj_div_exclude 가드와 normalize_abs
  --    정규화만 이번에 추가됐다(둘 다 빈 배열/false 가 기본값이라 기존 19개 개념은 무영향).
  with f as (
    select ff.bsns_year, ff.reprt_code, ff.fs_div, ac.concept, ac.is_stock,
           case when ac.normalize_abs then abs(ff.amount) else ff.amount end as amount,
           ff.amount_cum
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
      and not (ff.sj_div = any(ac.sj_div_exclude))
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
    -- Q4: 스톡은 연말 잔액(a_y) 그대로. 플로우는 원칙적으로 "연간 − Q3 누적(c_q3)"이지만
    -- 현금흐름 3계정 + capex 는 c_q3 가 안정적이지 않아(capex 실측: amount_cum 커버리지
    -- 0.00%, 4개 reprt_code 전부) 그 경로로는 Q4 가 거의 항상 NULL이 되는 결함이 있었다
    -- (20260823000005 3부 설명, capex 도 같은 결함이라 같은 리스트에 추가) — 이 네 개념만
    -- 분기 단독값 3개의 합(a_q1+a_q2+a_q3)을 쓴다. 어느 경로든 필요한 입력이 하나라도
    -- 없으면 이 UNION 브랜치가 그 행을 아예 만들지 않는다(NULL 을 강제로 만들지 않는다).
    select bsns_year, fs_div, 'Q4', concept, is_stock,
           case
             when is_stock then a_y
             when concept in ('cf_operating', 'cf_investing', 'cf_financing', 'capex')
               then a_y - (a_q1 + a_q2 + a_q3)
             else a_y - c_q3
           end,
           null
      from agg
      where a_y is not null
        and (
          is_stock
          or (concept in ('cf_operating', 'cf_investing', 'cf_financing', 'capex')
              and a_q1 is not null and a_q2 is not null and a_q3 is not null)
          or (concept not in ('cf_operating', 'cf_investing', 'cf_financing', 'capex')
              and c_q3 is not null)
        )
  ),
  -- q: 분기에 통시적 인덱스 qi = 연도*4 + n 을 붙인다. TTM 창이 연도 경계를 넘기 위해서다.
  q as (
    select bsns_year, fs_div, concept, is_stock, v,
           bsns_year * 4 + substr(period_type, 2, 1)::integer as qi
    from base where period_type in ('Q1','Q2','Q3','Q4')
  ),
  -- ttm_end: 그 해에 존재하는 마지막 분기. TTM 의 기준 시점을 여기서 고정한다.
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
           max(v) filter (where concept = 'current_bonds')         as current_bonds,
           max(v) filter (where concept = 'current_assets')        as current_assets,
           max(v) filter (where concept = 'current_liabilities')   as current_liabilities,
           max(v) filter (where concept = 'inventories')           as inventories,
           max(v) filter (where concept = 'capital_stock')         as capital_stock,
           max(v) filter (where concept = 'retained_earnings')     as retained_earnings,
           max(v) filter (where concept = 'capital_surplus')       as capital_surplus,
           max(v) filter (where concept = 'capex')                 as capex,
           max(v) filter (where concept = 'interest_expense')      as interest_expense
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
    current_assets, current_liabilities, inventories,
    capital_stock, retained_earnings, capital_surplus,
    capex, interest_expense,
    -- 정밀도: 기존과 동일하게 소수 2자리(20260823000005 가 확립).
    round(100.0 * gross_profit     / nullif(revenue, 0), 2),
    round(100.0 * operating_income / nullif(revenue, 0), 2),
    round(100.0 * net_income       / nullif(revenue, 0), 2),
    round(100.0 * net_income       / nullif(equity,  0), 2),
    round(100.0 * liabilities      / nullif(equity,  0), 2),
    round(100.0 * current_assets                              / nullif(current_liabilities, 0), 2),
    round(100.0 * (current_assets - coalesce(inventories, 0)) / nullif(current_liabilities, 0), 2),
    round(100.0 * (retained_earnings + capital_surplus)       / nullif(capital_stock, 0), 2),
    round(100.0 * equity                                       / nullif(assets, 0), 2),
    -- 이자보상배율: 배수(×) 다 — 100 을 곱하지 않는다(%가 아니므로 _pct 접미도 쓰지 않는다).
    round(operating_income / nullif(interest_expense, 0), 2)
  from d;

  get diagnostics n = row_count;
  return n;
end;
$fn$;

comment on function internal.fin_periods_rebuild(text) is
  'fin_periods 에서 한 회사분을 지우고 financial_facts 로부터 다시 계산한다. 계산 규칙의 '
  '단일 정의 — 다른 어디에도 사본이 없다. 2026-08-25(20260825000001): capex(유형자산의 취득)·'
  'interest_expense(이자비용)·interest_coverage(이자보상배율, 배수) 추가. account_concepts 에 '
  'sj_div_exclude(concept 매칭에서 제외할 sj_div)·normalize_abs(abs() 부호 정규화) 컬럼 추가 — '
  'interest_expense 는 sj_div=''CF'' 오매칭을 구조적으로 차단하고, capex·interest_expense 는 '
  '부호를 정규화한다. capex 는 amount_cum 결손이 있어 Q4 특례 리스트(cf_operating/investing/'
  'financing)에 합류.';

-- internal.fin_periods_refresh(text[]) 는 이 함수를 회사 단위로 호출만 하는 루프라
-- 시그니처·본문 모두 변경 없음 — 재선언하지 않는다.

-- ─────────────────────────────────────────────── 4부. 이 마이그레이션 이후 해야 할 일
--
-- ★ ALTER TABLE 은 기존 134,279행에 새 컬럼 3개를 NULL로 추가할 뿐, 값을 채우지 않는다.
--   채우려면 internal.fin_periods_rebuild() 가 다시 돌아야 한다 — 20260806000001·
--   20260823000005 가 확립한 것과 같은 수동 갱신 원칙(Management API 는 120초 상한이 있어
--   전량 갱신에 못 미친다).
--
--   전량 (직결 psql — 상한 없음):
--     select * from internal.fin_periods_refresh();
--   전량 (supabase db query --linked — 120초 상한이 있으므로 1,000개사씩 4번):
--     select * from internal.fin_periods_refresh((select array_agg(corp_code)
--       from (select corp_code from companies order by corp_code offset 0 limit 1000) t));
--     -- offset 1000 / 2000 / 3000 으로 세 번 더
--
-- 이 파일 자체는 select 문을 실행하지 않는다 — 여기서 refresh 를 호출하지 않는다.
