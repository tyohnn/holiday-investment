-- RLS 잠금: analyses·trackings 를 anon/authenticated 로부터 비공개 전환.
--
-- 배경: 0001 이 만든 "public read" 정책 + 스키마 전체 블랭킷 grant 는 companies·filings 같은
-- DART 공개데이터에는 맞지만, anon 키는 클라이언트 번들에 그대로 노출된다
-- (apps/web/lib/platform/db.ts 의 NEXT_PUBLIC_SUPABASE_ANON_KEY) — 즉 지금은 누구나
-- `GET /rest/v1/analyses?select=*` 로 낙점 적정주가·상승여력을 그냥 읽어갈 수 있었다.
--
-- 이 마이그레이션이 비공개로 돌리는 건 둘뿐이다:
--   - analyses  — P-C 에서 크레딧으로 팔 목적의 판정 결과 (fair_price·upside_pct·valuation …)
--   - trackings — 수작업으로 큐레이션하는 append-only 사실 원장
-- 나머지 10개 테이블 + 4개 뷰(companies, filings, financial_facts, report_items, events,
-- ownership_txns, registrations, filing_docs, filing_sections, account_concepts,
-- financial_metrics, annual_summary, filing_corrections, filing_correction_chains)는
-- DART 공시로 공공데이터다 — 0001/0002/0004/0006 주석이 이미 그렇게 명시했고, 여기서는
-- 건드리지 않는다.
--
-- 방식: RLS 는 이미 켜져 있다(0001). "public read" 정책만 지우고 select grant 를 회수하면
-- permissive 정책이 없는 상태가 되어 anon/authenticated 는 기본적으로 deny 다.
-- service_role 은 RLS 를 우회하므로 서버(ingest, apps/web 의 서비스 롤 클라이언트)는
-- 그대로 읽고 쓴다. authenticated 도 함께 회수하는 이유: 이 앱에는 로그인이 없으므로
-- authenticated 권한은 실사용처가 없는 잠재적 구멍일 뿐이다.
--
-- 주의: 0001 의 `grant select on all tables in schema public to anon, authenticated` 는
-- "스키마의 모든 테이블"을 대상으로 하는 블랭킷 grant 다. 앞으로 누군가 같은 패턴을
-- 새 마이그레이션에 또 쓰면(예: 신규 테이블 추가하며 편의상 복붙) 이 두 테이블도 조용히
-- 다시 뚫린다 — 새 블랭킷 grant 를 쓰기 전에 이 파일을 먼저 볼 것.

drop policy if exists "public read" on analyses;
drop policy if exists "public read" on trackings;

revoke select on analyses, trackings from anon, authenticated;

-- RLS 는 계속 켜진 상태로 둔다(0001 에서 이미 enable) — permissive 정책이 없으므로
-- anon/authenticated 에게는 이 자체로 전면 거부다. service_role 은 RLS 대상이 아니다.
