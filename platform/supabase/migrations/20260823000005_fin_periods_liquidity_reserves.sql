-- fin_periods 확장 — 유동성·유보율 지표 + 현금흐름 Q4/TTM 결함 수정 + 비율 정밀도 통일.
--
-- 배경: 20260806000001(fin_periods)이 만든 스크리너 표면에 유동비율·당좌비율·유보율·
-- 자기자본비율이 빠져 있었다. 계정 매핑은 Storage 원본(`fin/<corp_code>.json.gz`, DB 아님)
-- 12개사 표본으로 실측했다 — 유동자산·유동부채·자본금·유보액(이익잉여금+자본잉여금)은
-- 삼성전자 2022A(CFS) 기준 FnGuide 값과 억 단위(유보액은 오차 0)까지 일치를 확인했다.
-- 이 마이그레이션은 **DB 에 아무것도 쓰지 않는다** — financial_facts 가 별도 프로세스로
-- Storage 에서 복원되는 중이라, 이 파일이 머지된 뒤 그 복원이 끝나면 운영자가 파일 끝의
-- 안내대로 internal.fin_periods_refresh() 를 수동으로 돌려야 새 컬럼이 채워진다(기존
-- 20260806000001 이 확립한 것과 같은 수동 갱신 원칙 — 3부 참고).

-- ─────────────────────────────────────────────── 1부. account_concepts 6개 추가
--
-- 전부 스톡(재무상태표 시점값)이라 is_stock = true. 매핑 실측 표본은 12개사
-- (삼성전자·크래프톤·에코프로비엠·SK하이닉스·현대자동차·하나금융지주·삼성증권·삼성생명·
-- 선진뷰티사이언스·브이티·광동헬스바이오·진코스텍) — 은행·증권·보험 3사는 유동/비유동
-- 구분이 있는 재무상태표 자체가 없어(업종 회계 관행) current_assets/current_liabilities/
-- inventories 가 구조적으로 NULL 이다. 결측이 아니라 업종 특성이므로 0 으로 채우지 않는다.

insert into account_concepts (concept, label, account_id, account_id_alts, name_alts, is_stock) values
  ('current_assets', '유동자산', 'ifrs-full_CurrentAssets',
     array[]::text[], array['유동자산'], true),
  ('current_liabilities', '유동부채', 'ifrs-full_CurrentLiabilities',
     array[]::text[], array['유동부채'], true),
  ('inventories', '재고자산', 'ifrs-full_Inventories',
     array[]::text[], array['재고자산'], true),
  ('capital_stock', '자본금', 'ifrs-full_IssuedCapital',
     array[]::text[], array['자본금'], true),
  ('retained_earnings', '이익잉여금', 'ifrs-full_RetainedEarnings',
     array[]::text[], array['이익잉여금', '이익잉여금(결손금)'], true),
  ('capital_surplus', '자본잉여금', 'dart_CapitalSurplus',
     array['ifrs-full_SharePremium'], array['자본잉여금', '주식발행초과금'], true)
on conflict (concept) do nothing;

comment on column account_concepts.concept is
  'fin_periods 컬럼명과 1:1 대응하는 개념 키. capital_surplus 는 회사 10/12가 dart_CapitalSurplus '
  '합계 라인을 직접 보고하고 나머지 2/12(삼성전자·에코프로비엠)는 구성요소가 주식발행초과금 '
  '하나뿐이라 상위 합계를 안 그린다 — 두 account_id 를 별칭으로 묶어 max(amount) 로 하나를 '
  '고른다(표본에서 두 계정이 동시에 존재한 회사는 없었으나 전수는 미검증).';

-- ★ 만들지 않은 개념 — 여기 근거만 남기고 넣지 않는다.
--
--   interest_expense(이자비용): 삼성전자·SK하이닉스·현대자동차·크래프톤 등 대형 비금융사는
--     전 연도·전 sj_div 를 통틀어 "이자비용" 계정이 본표에 단 하나도 없다(전수 스캔 확인).
--     반면 금융 3사는 ifrs-full_InterestExpense 가 손익의 본선 항목으로 직접 보고되고,
--     비금융 중소형사 일부는 dart_AdjustmentsForInterestExpenses(현금흐름표 간접법 조정
--     항목)로만 근사가 가능하다. 즉 "존재 여부 자체가 회사군에 따라 구조적으로 갈리는"
--     개념이라 하나의 컬럼으로 합치면 회사군마다 성격이 다른 값(본선 항목 vs 조정치 vs
--     결측)이 섞인다. 이자보상배율은 이 데이터셋에서 대형 비금융사에 대해 구조적으로 계산
--     불가능하다 — fin_details/주석 영역의 몫으로 남긴다.
--
--   net_debt 의 FnGuide 호환 버전: 아래 net_debt 컬럼 코멘트 참고.

-- ─────────────────────────────────────────────── 2부. fin_periods 컬럼 10개 추가

alter table fin_periods
  add column if not exists current_assets      numeric,
  add column if not exists current_liabilities numeric,
  add column if not exists inventories         numeric,
  add column if not exists capital_stock       numeric,
  add column if not exists retained_earnings   numeric,
  add column if not exists capital_surplus     numeric,
  add column if not exists current_ratio_pct   numeric,
  add column if not exists quick_ratio_pct     numeric,
  add column if not exists reserve_ratio_pct   numeric,
  add column if not exists equity_ratio_pct    numeric;

comment on column fin_periods.current_assets is
  '유동자산. 은행·증권·보험은 유동/비유동 구분이 있는 재무상태표 자체가 없어 구조적으로 '
  'NULL이다(업종 특성 — 결측 아님). 삼성전자 2022A(CFS) 재현: DB 2,184,705.81억 vs '
  'FnGuide 2,184,706억, 일치.';
comment on column fin_periods.current_liabilities is
  '유동부채. current_assets 와 동일하게 은행·증권·보험은 구조적으로 NULL. 삼성전자 2022A '
  '재현: DB 783,448.52억 vs FnGuide 783,449억, 일치.';
comment on column fin_periods.inventories is
  '재고자산. 재고가 없는 업종(게임 등 무재고 서비스업 — 크래프톤 BS 를 전 계정 덤프해도 '
  '재고 관련 항목이 없음을 확인)과 은행·증권·보험은 NULL이다. quick_ratio_pct 계산에서는 '
  'COALESCE(inventories, 0) 으로 0 취급한다(컬럼 코멘트 참고). 삼성전자 2022A 는 FnGuide '
  '당좌자산 역산치 대비 0.85%(4,437억) 차이가 있었다 — 원인 미확인(재고자산 평가충당금 '
  '차감 여부, 노트 세부항목 분해 방식 등 추정만 가능, financial_facts 본표로는 검증 불가).';
comment on column fin_periods.capital_stock is
  '자본금(액면가 기준 납입자본). 삼성전자 2022A 재현: DB 8,975.14억 vs FnGuide 8,975억, 일치.';
comment on column fin_periods.retained_earnings is
  '이익잉여금(결손금 포함). reserve_ratio_pct(유보율)의 분자 절반 — capital_surplus 참고.';
comment on column fin_periods.capital_surplus is
  '자본잉여금 — dart_CapitalSurplus 우선, 없으면 ifrs-full_SharePremium(주식발행초과금)을 '
  '쓴다(account_concepts.capital_surplus 코멘트 참고). reserve_ratio_pct(유보율)의 분자 '
  '절반. 삼성전자 2022A 재현: 이익잉여금+자본잉여금 = 3,423,503.00억 vs FnGuide 유보액 '
  '3,423,503억, 오차 0 으로 정확히 일치.';

comment on column fin_periods.current_ratio_pct is
  '100 * current_assets / current_liabilities. 은행·증권·보험은 두 입력이 모두 NULL이라 '
  '결과도 NULL(0이 아니다).';
comment on column fin_periods.quick_ratio_pct is
  '100 * (current_assets - COALESCE(inventories, 0)) / current_liabilities. 재고자산이 '
  '없는 회사(무재고 업종)는 재고를 0 취급한다 — 유동자산 총계는 이미 확정된 값이고 그 '
  '하위 구성요소 하나가 안 잡히는 것뿐이므로 안전하다(전 항목이 결측이면 판단 불가로 '
  'NULL 을 두는 borrowings_total 과는 성격이 다르다: 그쪽은 독립된 항목 5개의 합이라 '
  '전부 결측이면 "0인지 못 찾았는지" 구분이 안 되지만, 재고자산은 유동자산이라는 확정된 '
  '총계의 하위 항목이다). 다만 inventories 컬럼 코멘트의 0.85% 오차(원인 미확인)가 그대로 '
  '전파되므로 정밀 비교보다는 근사 스크리닝 용도로 쓸 것.';
comment on column fin_periods.reserve_ratio_pct is
  '100 * (retained_earnings + capital_surplus) / capital_stock. FnGuide 유보율과 같은 '
  '정의 — 삼성전자 2022A 재현 시 오차 0으로 정확히 일치했다. retained_earnings 나 '
  'capital_surplus 중 하나라도 NULL이면 결과도 NULL(0으로 보정하지 않는다 — 두 항목 모두 '
  '표본 커버리지가 사실상 100%라 결측이면 계정 매칭 실패일 가능성이 높고, 그런 경우를 '
  '0으로 덮으면 유보율이 실제보다 낮게 왜곡된다).';
comment on column fin_periods.equity_ratio_pct is
  '100 * equity / assets. 기존 debt_ratio_pct(=100*liabilities/equity)와 짝을 이루는 '
  '자기자본비율 — 둘 다 필요할 때가 많아 하나를 계산하고 다른 하나를 유도하게 두지 않는다.';

comment on column fin_periods.net_debt is
  'borrowings_total - cash (차입금 합계 대비 순부채, borrowings_total 이나 cash 중 하나라도 '
  'NULL이면 NULL). FnGuide 의 순차입금과 정의가 다르다 — FnGuide 는 현금성자산에 단기금융상품을 '
  '더한 뒤 차입금을 뺀다. 삼성전자 2022A 로 확인: 이 컬럼은 -39.3조(과제 제공값과 일치), '
  'FnGuide 식(현금+단기금융상품 기준)으로 역산하면 -105조. 단기금융상품 '
  '(dart_ShortTermDepositsNotClassifiedAsCashEquivalents 등)을 더해 FnGuide 호환 컬럼을 '
  '만드는 안을 검토했으나 보류했다 — 12개사 표본 커버리지가 42%로 낮고, 없는 이유가 '
  '회사마다 다르다(은행·증권·보험은 자산 분류 체계 자체가 달라 구조적으로 없음, 크래프톤은 '
  '동등한 성격의 자산을 유동성당기손익-공정가치측정금융자산이라는 전혀 다른 계정으로 '
  '보유, 일부는 실제로 안 갖고 있음). 전 종목에 일관되게 적용할 단일 계정 매핑이 없어 '
  '넣으면 회사마다 다른 기준으로 계산된 값이 한 컬럼에 섞인다 — 알려진 공백으로 남긴다.';

-- ─────────────────────────────────────────────── 3부. fin_periods_rebuild 전체 교체
--
-- 계산 규칙의 단일 정의를 20260806000001 원칙 그대로 유지한다 — 새 컬럼 10개를 INSERT
-- 절과 최종 SELECT 에 추가하고, 기존 5개 비율(gpm/opm/npm/roe/debt_ratio_pct)의 반올림을
-- round(...,1) → round(...,2) 로 통일하며(예: 26.40 이 나와야 할 값이 소수 1자리 반올림
-- 경로에 따라 26.41 처럼 보이는 정밀도 손실을 없앤다), cf_operating/cf_investing/
-- cf_financing 의 Q4 계산식을 고친다. 그 외(f/agg/q/ttm_end/ttm/long CTE, gross_profit·
-- ebitda·borrowings_total 파생, TTM 판정 로직)는 원본과 동일 — 원본과 달라진 지점만
-- 아래에 표시한다.
--
-- ── cf_operating/cf_investing/cf_financing 의 Q4·TTM 결함
-- 기존 Q4 공식은 스톡이 아닌 모든 플로우 개념에 "연간(a_y) − Q3 누적(c_q3, reprt_code
-- 11014 의 amount_cum)"을 썼다. 매출액 등 손익 개념은 이 경로가 정확하다(HIDM-2 실측:
-- 삼성전자 2024 1~3분기 amount 합 225.1조 = amount_cum 225.1조, 정확히 일치). 그런데
-- 현금흐름 3계정은 c_q3(11014 의 amount_cum)가 안정적으로 채워지지 않아 — 원인은 이
-- 리서치의 범위 밖이라 확인하지 않았다(가능성 있는 설명: 국내 분기·반기보고서의 현금흐름표는
-- 관행상 해당 분기 3개월 단독 수치를 따로 공시하지 않고 연초 누적 수치만 신고하는 경우가
-- 있어, DART XBRL 이 이 계정들에 amount_cum 컨텍스트를 별도로 채우지 않을 수 있다 — 검증
-- 안 됨 — 여기서는 사실로 단정하지 않는다) — 그 결과 c_q3 가 거의 항상 NULL이라 Q4 가
-- 통째로 NULL이 되고, Q4 가 없으니 TTM(최근 4분기 합, count(*)=4 요구)도 항상 NULL이 되는
-- 결함이 있었다. 고침: 이 세 개념만 Q4 = 연간 − (Q1 단독 + Q2 단독 + Q3 단독) 으로, 즉
-- amount_cum 이 아니라 분기 단독값 3개(a_q1+a_q2+a_q3, 이미 agg 에 있고 커버리지가 c_q3보다
-- 안정적으로 관측됨)를 직접 합산한다. 셋 중 하나라도 NULL이면 그 Q4 행 자체를 만들지
-- 않는다(강제로 만들지 않는다 — 지시 그대로). TTM 은 q/ttm CTE 가 이미 개념에 무관하게
-- 일반적으로 동작하므로 Q4 가 고쳐지면 자동으로 따라온다 — 별도 수정 불필요.

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
    gpm_pct, opm_pct, npm_pct, roe_pct, debt_ratio_pct,
    current_ratio_pct, quick_ratio_pct, reserve_ratio_pct, equity_ratio_pct
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
    -- Q4: 스톡은 연말 잔액(a_y) 그대로. 플로우는 원칙적으로 "연간 − Q3 누적(c_q3)"이지만
    -- 현금흐름 3계정은 c_q3 가 안정적이지 않아 그 경로로는 Q4 가 거의 항상 NULL이 되는
    -- 결함이 있었다(위 3부 설명 참고) — 이 세 개념만 분기 단독값 3개의 합(a_q1+a_q2+a_q3)을
    -- 쓴다. 어느 경로든 필요한 입력이 하나라도 없으면 이 UNION 브랜치가 그 행을 아예
    -- 만들지 않는다(NULL 을 강제로 만들지 않는다).
    select bsns_year, fs_div, 'Q4', concept, is_stock,
           case
             when is_stock then a_y
             when concept in ('cf_operating', 'cf_investing', 'cf_financing')
               then a_y - (a_q1 + a_q2 + a_q3)
             else a_y - c_q3
           end,
           null
      from agg
      where a_y is not null
        and (
          is_stock
          or (concept in ('cf_operating', 'cf_investing', 'cf_financing')
              and a_q1 is not null and a_q2 is not null and a_q3 is not null)
          or (concept not in ('cf_operating', 'cf_investing', 'cf_financing')
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
           max(v) filter (where concept = 'capital_surplus')       as capital_surplus
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
    -- 정밀도: 전부 소수 2자리로 통일(기존은 1자리 — round(x,1) 경로에서 26.40 이 나와야 할
    -- 값이 26.41 처럼 보이는 등 반올림 손실이 있었다). annual_summary 와의 교차검증 대상인
    -- gpm/opm/npm/roe/debt_ratio_pct 도 포함해 전부 바꾼다 — 반올림 자릿수가 다르면 그
    -- 교차검증 자체가 깨진다.
    round(100.0 * gross_profit     / nullif(revenue, 0), 2),
    round(100.0 * operating_income / nullif(revenue, 0), 2),
    round(100.0 * net_income       / nullif(revenue, 0), 2),
    round(100.0 * net_income       / nullif(equity,  0), 2),
    round(100.0 * liabilities      / nullif(equity,  0), 2),
    round(100.0 * current_assets                              / nullif(current_liabilities, 0), 2),
    round(100.0 * (current_assets - coalesce(inventories, 0)) / nullif(current_liabilities, 0), 2),
    round(100.0 * (retained_earnings + capital_surplus)       / nullif(capital_stock, 0), 2),
    round(100.0 * equity                                       / nullif(assets, 0), 2)
  from d;

  get diagnostics n = row_count;
  return n;
end;
$fn$;

comment on function internal.fin_periods_rebuild(text) is
  'fin_periods 에서 한 회사분을 지우고 financial_facts 로부터 다시 계산한다. 계산 규칙의 '
  '단일 정의 — 다른 어디에도 사본이 없다. 2026-08-23(20260823000005): 유동자산·유동부채·'
  '재고자산·자본금·이익잉여금·자본잉여금 + 파생 비율 4개(current/quick/reserve/equity_ratio) '
  '추가, cf_operating/cf_investing/cf_financing 의 Q4·TTM 결함 수정, 전 _pct 컬럼 반올림을 '
  '소수 2자리로 통일.';

-- internal.fin_periods_refresh(text[]) 는 이 함수를 회사 단위로 호출만 하는 루프라
-- 시그니처·본문 모두 변경 없음 — 재선언하지 않는다.

-- ─────────────────────────────────────────────── 4부. 이 마이그레이션 이후 해야 할 일
--
-- ★ ALTER TABLE 은 기존 134,279행(2026-08-06 최초 적재 기준)에 새 컬럼 10개를 NULL로
--   추가할 뿐, 값을 채우지 않는다. 채우려면 internal.fin_periods_rebuild() 가 다시 돌아야
--   하는데, 그러려면 financial_facts 가 준비돼 있어야 한다 — 지금 별도 프로세스가 그것을
--   Storage 에서 복원 중이다(수 시간 소요, 이 마이그레이션 작성 시점 기준 진행 중).
--   **복원이 끝난 뒤에만** 아래를 운영자가 SQL 연결에서 직접 실행한다(20260806000001 이
--   확립한 것과 같은 수동 갱신 원칙 — Management API 는 120초 상한이 있어 전량 갱신에
--   못 미친다).
--
--   전량 (직결 psql — 상한 없음):
--     select * from internal.fin_periods_refresh();
--   전량 (supabase db query --linked — 120초 상한이 있으므로 1,000개사씩 4번):
--     select * from internal.fin_periods_refresh((select array_agg(corp_code)
--       from (select corp_code from companies order by corp_code offset 0 limit 1000) t));
--     -- offset 1000 / 2000 / 3000 으로 세 번 더
--
-- 이 파일 자체는 select 문을 실행하지 않는다 — 여기서 refresh 를 호출하지 않는다.
