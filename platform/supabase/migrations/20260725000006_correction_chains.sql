-- A1 마무리: 기재정정 체인 — 정정 공시 ↔ 원본 공시 연결.
--
-- 설계: 체인은 보고서명(정정 프리픽스 제거)이 같은 직전 공시로 결정론적으로 유도 가능
-- → 저장하지 않고 뷰로 파생한다 (filings.corrects_rcept_no 컬럼은 미사용이므로 제거).
-- 정기보고서는 이름에 기간이 박혀 있어("사업보고서 (2025.12)") 자연스럽게 같은 분기끼리 묶인다.

alter table filings drop column if exists corrects_rcept_no;

create view filing_correction_chains as
select
  f.corp_code,
  f.rcept_no                                            as correction_rcept_no,
  f.rcept_dt                                            as correction_dt,
  f.report_nm                                           as correction_report_nm,
  regexp_replace(f.report_nm, '^(\[[^\]]+\])+\s*', '')  as base_report_nm,
  o.rcept_no                                            as original_rcept_no,
  o.rcept_dt                                            as original_dt,
  o.report_nm                                           as original_report_nm,
  (f.rcept_dt - o.rcept_dt)                             as days_after_original
from filings f
left join lateral (
  select o.rcept_no, o.rcept_dt, o.report_nm
  from filings o
  where o.corp_code = f.corp_code
    and o.rcept_no < f.rcept_no
    and regexp_replace(o.report_nm, '^(\[[^\]]+\])+\s*', '')
        = regexp_replace(f.report_nm, '^(\[[^\]]+\])+\s*', '')
  order by o.rcept_no desc
  limit 1
) o on true
where f.is_correction;

grant select on filing_correction_chains to anon, authenticated, service_role;
