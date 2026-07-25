-- A1 확장: 공시 원문 전량 + 목차 섹션(주석 포함) + 증권신고서.
--
-- 왜: ①주석·사업의내용이 DB 행이 되면 전문검색·UI 렌더·트래킹 출처 참조가 가능해진다
--     ②원문 확보 여부를 filing_docs 가 추적해 증분 수집이 된다 ③증권신고서는 유증·합병의
--     상세 조건(지분 희석)을 담는다.
-- 검색: 한국어 tsvector 는 형태소 분석기 없이 품질이 낮고 1MB 제한도 있어, 파일럿은
--       pg_trgm GIN + ILIKE 로 간다 ("%지급보증%" 식 부분일치 — 실측 후 재판단).

create extension if not exists pg_trgm;

-- 원문 파일 메타 (파일 자체는 data/raw/<corp>/docs/<rcept_no>.zip 에 보존)
create table filing_docs (
  rcept_no    text primary key references filings on delete cascade,
  file_name   text,                  -- zip 내 대표 문서 파일명
  n_files     int,                   -- zip 내 파일 수
  n_sections  int,
  bytes       int,                   -- 대표 문서 크기
  status      text not null default 'ok',   -- ok | error:<사유>
  fetched_at  timestamptz not null default now()
);

-- 목차 단위 섹션 — 주석(★)·사업의내용(☆) 플래그
create table filing_sections (
  id        bigint generated always as identity primary key,
  rcept_no  text not null references filings on delete cascade,
  sec_no    int  not null,
  title     text not null,
  content   text not null,
  is_note   boolean not null default false,
  is_biz    boolean not null default false
);
create index fs_rcept on filing_sections (rcept_no, sec_no);
create index fs_flags on filing_sections (is_note, is_biz);
create index fs_content_trgm on filing_sections using gin (content gin_trgm_ops);

-- 증권신고서 (DS006, group 평탄화 payload)
create table registrations (
  id        bigint generated always as identity primary key,
  corp_code text not null references companies on delete cascade,
  reg_type  text not null,           -- 지분증권 | 채무증권 | 합병 | 분할 | …
  rcept_no  text,
  rcept_dt  date,
  payload   jsonb not null
);
create index reg_lookup on registrations (corp_code, reg_type, rcept_dt desc);

do $$
declare t text;
begin
  foreach t in array array['filing_docs','filing_sections','registrations'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;
grant select on filing_docs, filing_sections, registrations to anon, authenticated;
grant all on filing_docs, filing_sections, registrations to service_role;
grant all on all sequences in schema public to service_role;
