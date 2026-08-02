-- 스키마 전면 잠금: public 의 모든 릴레이션을 service_role 전용으로 전환.
--
-- 배경: anon 키는 설계상 클라이언트 번들에 실려 나간다(정상 동작이다, 유출이 아니다).
-- 따라서 "anon 이 읽을 수 있다" = "인터넷 전체가 읽을 수 있다" 와 같은 말이다.
-- 20260802000001 은 analyses·trackings 만, 20260802000004 는 ingest 운영 3테이블만
-- 그렇게 닫았고, 나머지는 "DART 공시라 어차피 공공데이터"라는 이유로 열어뒀다.
--
-- 그 이유는 이제 성립하지 않는다. 원본이 공개라는 것과, 우리가 3,978개 상장사분을
-- 정규화·정정체인·섹션 분해까지 마쳐 즉시 질의 가능한 형태로 쌓아둔 것을 통째로
-- 퍼가게 두는 것은 다른 문제다. 그리고 읽기를 전부 서버(service_role)로 돌리면
-- 배포된 번들이 노출하는 자격증명이 아예 0개가 된다 — anon 키 자체가 사라진다.
-- 그게 이 마이그레이션이 노리는 최종 상태다.
--
-- 방식은 앞의 둘과 동일하다: RLS 는 켠 채로 두고 permissive 정책을 전부 없애
-- anon/authenticated 를 기본 거부로 만들고(1겹), role grant 도 회수한다(2겹).
-- service_role 은 RLS 를 우회하고 grant 도 손대지 않으므로 ingest 와 apps/web 의
-- 서버 컴포넌트는 그대로 동작한다.
--
-- ★ 뷰에는 RLS 가 없다. financial_metrics·annual_summary·filing_corrections·
--   filing_correction_chains 는 relrowsecurity=false 이고 정책을 걸 수도 없다 —
--   접근 통제 수단이 grant 하나뿐이다. 즉 뷰에서는 revoke 가 유일한 잠금장치이며,
--   기반 테이블을 닫아도 뷰 grant 가 남아 있으면 뷰를 통해 그대로 새어 나간다
--   (이 뷰들은 security_invoker 가 아니라 소유자 권한으로 돈다).
--
-- 회수 대상 권한은 호스티드 DB 의 information_schema.role_table_grants 를 실제로
-- 조회해서 정했다. SELECT 만 있을 거라는 짐작은 틀렸다 — 아래 14개 릴레이션은
-- anon·authenticated 가 7개 권한(SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/
-- TRIGGER)을 전부 들고 있었다. 특히 TRUNCATE 는 RLS 로 걸러지지 않는다.

drop policy if exists "public read" on companies;
drop policy if exists "public read" on filings;
drop policy if exists "public read" on financial_facts;
drop policy if exists "public read" on report_items;
drop policy if exists "public read" on events;
drop policy if exists "public read" on ownership_txns;
drop policy if exists "public read" on registrations;
drop policy if exists "public read" on filing_docs;
drop policy if exists "public read" on filing_sections;
drop policy if exists "public read" on account_concepts;

-- 기반 테이블 10개 + 뷰 4개 — 실측한 7개 권한 전량 회수.
revoke select, insert, update, delete, truncate, references, trigger
  on companies, filings, financial_facts, report_items, events, ownership_txns,
     registrations, filing_docs, filing_sections, account_concepts,
     financial_metrics, annual_summary, filing_corrections, filing_correction_chains
  from anon, authenticated;

-- analyses·trackings 는 20260802000001 이 SELECT 만 회수했다. 나머지 6개는 그대로
-- 남아 있었다 — INSERT/UPDATE/DELETE 는 정책이 없어 RLS 가 막지만 TRUNCATE 는 안 막는다.
-- (안 들고 있는 SELECT 를 다시 회수해도 무해하지만, 실측 권한 집합을 그대로 적는다.)
revoke insert, update, delete, truncate, references, trigger
  on analyses, trackings
  from anon, authenticated;

-- ingest_corps·ingest_progress·ingest_api_quota 는 20260802000004 에서 7개 전량
-- 회수 완료(실측 확인) — 여기서 다시 손대지 않는다.

-- ─────────────────────────────────────────────── 상시 재개방 차단
--
-- 이 잠금을 "한 번 하고 끝"이 아니라 지속되게 만드는 게 아래 한 줄이다.
-- 재개방 경로가 둘 있었다:
--   (1) 20260725000001 의 `grant select on all tables in schema public to anon,
--       authenticated` — 실행 시점 스키마 전체를 여는 블랭킷 grant. 누가 새 테이블을
--       추가하며 이 줄을 복붙하면 전부 되열린다.
--   (2) 호스티드 Supabase 는 public 스키마에 default privileges 를 미리 걸어둬서,
--       마이그레이션이 grant 를 한 줄도 안 써도 신규 테이블이 anon·authenticated 에게
--       7개 권한을 자동으로 받는다(20260802000004 가 발견한 그 동작). 로컬 스택은
--       이걸 재현하지 않으므로 로컬 검증만으로는 절대 잡히지 않는다.
-- (2)를 여기서 끊는다. (1)은 코드 리뷰로 막는 수밖에 없다.
--
-- 주의: ALTER DEFAULT PRIVILEGES 는 "누가 만든 객체냐"별로 걸린다. 이 문장은 이
-- 마이그레이션을 실행하는 롤(postgres)이 앞으로 만들 테이블에 적용된다 — 마이그레이션이
-- 만드는 테이블이 정확히 그것이다. pg_default_acl 에는 supabase_admin 소유 항목도
-- 따로 있지만 그건 플랫폼이 내부적으로 만드는 객체용이라 여기서 건드리지 않는다.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- 이 시점 이후 public 스키마의 anon/authenticated 접근권은 0이다. DB 로 들어오는
-- 유일한 경로는 service_role 이고, 그 키는 서버에만 있다(apps/web/lib/platform/db.ts,
-- platform/ingest/ingest.py). 앞으로 새 테이블을 추가할 때 anon 에게 무언가를
-- 열어주고 싶다면, 그건 "실수로 열림"이 아니라 명시적 grant 로만 가능해야 한다.
