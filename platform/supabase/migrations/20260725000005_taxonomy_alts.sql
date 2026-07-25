-- A1 시행착오 #3: XBRL 택소노미에 세대가 있다 — 구버전은 'ifrs_Revenue',
-- 신버전은 'ifrs-full_Revenue' (에코프로비엠 초기 연도 실측). account_id 도메인은
-- 공간(회사 커스텀 태그)뿐 아니라 시간(택소노미 버전)으로도 열린 집합이다.
-- → enum 이 아니라 개념 테이블에 별칭 배열을 둔다.

alter table account_concepts add column account_id_alts text[] not null default '{}';

update account_concepts set account_id_alts = array[replace(account_id, 'ifrs-full_', 'ifrs_')]
where account_id like 'ifrs-full_%';

create or replace view financial_metrics as
select
  ff.corp_code, ff.bsns_year, ff.reprt_code, ff.fs_div,
  ac.concept, ac.label,
  ff.amount, ff.amount_prev, ff.rcept_no,
  ff.account_nm as raw_account_nm
from financial_facts ff
join account_concepts ac
  on (nullif(ff.account_id, '-표준계정코드 미사용-') = ac.account_id)
  or (ff.account_id = any(ac.account_id_alts))
  or ((ff.account_id is null or ff.account_id = '-표준계정코드 미사용-')
      and ff.account_nm = any(ac.name_alts))
where ff.amount is not null;
