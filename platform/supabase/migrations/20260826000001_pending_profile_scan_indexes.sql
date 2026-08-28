-- drain_pending / drain_sections / drain_notes 가 창 스캔마다
-- fin_details·filings 를 페이지 단위로 세 번 두들긴다. source_rcept_no 단독
-- 인덱스와 rcept_dt 인덱스가 없어 65개 워커가 REST 를 잠식했다.
-- 이 마이그레이션은 (1) 그 두 인덱스, (2) 주석 스캔용 NOTE rcept 부분 인덱스,
-- (3) 창 한 번에 pending 쌍을 돌려주는 RPC 를 둔다.
--
-- 호스티드 실측(2026-08-26): fin_details 167,585행/41MB · filings 1,932,479행/253MB
-- · financial_facts 13,954,213행/3GB. (1)(2)는 작아 즉시 생성, NOTE 부분 인덱스는
-- sj_div='NOTE' 행만이라 전표 3GB 를 다시 만들지 않는다.

create index if not exists fd_source_rcept
  on fin_details (source_rcept_no);

create index if not exists ch_source_rcept
  on corp_history (source_rcept_no);

create index if not exists filings_rcept_dt
  on filings (rcept_dt desc);

create index if not exists ff_note_rcept
  on financial_facts (rcept_no)
  where sj_div = 'NOTE';

create index if not exists filing_docs_pending_sections
  on filing_docs (rcept_no)
  where status = 'ok'
    and storage_path is not null
    and sections_extracted_at is null;

-- ─────────────────────────────────────────────── RPC
-- security invoker + anon/authenticated execute 회수. service_role 만 호출.
-- LIKE 패턴은 drain 스크립트가 상수로 넘긴다(* → %).

create or replace function public.pending_profile_rcepts(
  report_like text,
  dt_gte text,
  dt_lte text,
  n int default 400,
  exclude_rcepts text[] default '{}'
)
returns table(corp_code text, rcept_no text)
language sql
stable
security invoker
set search_path = public
as $$
  select f.corp_code, f.rcept_no
  from filings f
  join filing_docs d on d.rcept_no = f.rcept_no
  where f.report_nm like report_like
    and f.report_nm not like '%제출기한연장%'
    and f.rcept_dt >= to_date(dt_gte, 'YYYYMMDD')
    and f.rcept_dt <= to_date(dt_lte, 'YYYYMMDD')
    and d.status = 'ok'
    and d.storage_path is not null
    and not exists (
      select 1 from fin_details fd
      where fd.source_rcept_no = f.rcept_no
    )
    and (exclude_rcepts is null
         or cardinality(exclude_rcepts) = 0
         or f.rcept_no != all(exclude_rcepts))
  order by f.rcept_dt desc, f.rcept_no desc
  limit greatest(1, least(coalesce(n, 400), 4000));
$$;

create or replace function public.pending_section_rcepts(
  report_like text,
  dt_gte text,
  dt_lte text,
  n int default 80,
  exclude_rcepts text[] default '{}'
)
returns table(corp_code text, rcept_no text, storage_path text)
language sql
stable
security invoker
set search_path = public
as $$
  select f.corp_code, f.rcept_no, d.storage_path
  from filings f
  join filing_docs d on d.rcept_no = f.rcept_no
  where f.report_nm like report_like
    and f.report_nm not like '%제출기한연장%'
    and f.rcept_dt >= to_date(dt_gte, 'YYYYMMDD')
    and f.rcept_dt <= to_date(dt_lte, 'YYYYMMDD')
    and d.status = 'ok'
    and d.storage_path is not null
    and d.sections_extracted_at is null
    and (exclude_rcepts is null
         or cardinality(exclude_rcepts) = 0
         or f.rcept_no != all(exclude_rcepts))
  order by f.rcept_dt desc, f.rcept_no desc
  limit greatest(1, least(coalesce(n, 80), 4000));
$$;

create or replace function public.pending_notes_rcepts(
  report_like text,
  dt_gte text,
  dt_lte text,
  n int default 200,
  exclude_rcepts text[] default '{}'
)
returns table(corp_code text, rcept_no text, report_nm text)
language sql
stable
security invoker
set search_path = public
as $$
  select f.corp_code, f.rcept_no, f.report_nm
  from filings f
  join filing_docs d on d.rcept_no = f.rcept_no
  where f.report_nm like report_like
    and f.report_nm not like '%제출기한연장%'
    and f.rcept_dt >= to_date(dt_gte, 'YYYYMMDD')
    and f.rcept_dt <= to_date(dt_lte, 'YYYYMMDD')
    and d.status = 'ok'
    and d.storage_path is not null
    and d.sections_extracted_at is not null
    and not exists (
      select 1 from financial_facts ff
      where ff.rcept_no = f.rcept_no
        and ff.sj_div = 'NOTE'
    )
    and (exclude_rcepts is null
         or cardinality(exclude_rcepts) = 0
         or f.rcept_no != all(exclude_rcepts))
  order by f.rcept_dt desc, f.rcept_no desc
  limit greatest(1, least(coalesce(n, 200), 4000));
$$;

revoke all on function public.pending_profile_rcepts(text, text, text, int, text[])
  from public, anon, authenticated;
revoke all on function public.pending_section_rcepts(text, text, text, int, text[])
  from public, anon, authenticated;
revoke all on function public.pending_notes_rcepts(text, text, text, int, text[])
  from public, anon, authenticated;
grant execute on function public.pending_profile_rcepts(text, text, text, int, text[])
  to service_role;
grant execute on function public.pending_section_rcepts(text, text, text, int, text[])
  to service_role;
grant execute on function public.pending_notes_rcepts(text, text, text, int, text[])
  to service_role;

comment on function public.pending_profile_rcepts(text, text, text, int, text[]) is
  'ok 원문 정기보고서 중 fin_details.source_rcept_no 가 없는 (corp, rcept). drain_pending 전용.';
comment on function public.pending_section_rcepts(text, text, text, int, text[]) is
  'ok 원문 중 sections_extracted_at 이 비어 있는 회차. drain_sections 전용.';
comment on function public.pending_notes_rcepts(text, text, text, int, text[]) is
  '섹션이 있는 정기보고서 중 financial_facts sj_div=NOTE 가 없는 회차. drain_notes 전용.';
