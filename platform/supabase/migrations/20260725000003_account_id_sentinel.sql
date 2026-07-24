-- A1 시행착오 #2: XBRL 미적용 계정의 account_id 는 null 이 아니라
-- 문자열 센티널 '-표준계정코드 미사용-' 로 온다 (크래프톤 2022 '영업수익' 실측).
-- 0002 의 이름 폴백이 null 만 검사해 이런 행을 놓쳤다 → 센티널을 결측으로 취급한다.

create or replace view financial_metrics as
select
  ff.corp_code, ff.bsns_year, ff.reprt_code, ff.fs_div,
  ac.concept, ac.label,
  ff.amount, ff.amount_prev, ff.rcept_no,
  ff.account_nm as raw_account_nm
from financial_facts ff
join account_concepts ac
  on (nullif(ff.account_id, '-표준계정코드 미사용-') = ac.account_id)
  or ((ff.account_id is null or ff.account_id = '-표준계정코드 미사용-')
      and ff.account_nm = any(ac.name_alts))
where ff.amount is not null;
