-- 20260802000005 가 남긴 시퀀스 구멍 막기.
--
-- 배경: 20260802000005 는 public 의 테이블·뷰 14개에서 anon·authenticated 의 7개
-- 권한을 전량 회수했지만, 대상은 릴레이션(테이블/뷰)뿐이었다. 시퀀스는 별도
-- 객체이고 자체 grant 를 갖는다 — 호스티드 DB 를 실측하니 identity 컬럼을 쓰는
-- 8개 테이블의 시퀀스가 여전히 anon=rwU, authenticated=rwU 였다:
--   financial_facts_id_seq, report_items_id_seq, events_id_seq,
--   ownership_txns_id_seq, trackings_id_seq, analyses_id_seq,
--   filing_sections_id_seq, registrations_id_seq
--
-- 왜 이게 독립된 벡터인가: 시퀀스는 RLS 대상이 아니다(relrowsecurity 자체가 없다).
-- 시퀀스에 UPDATE 권한이 있으면 setval() 을 호출할 수 있고, nextval() 은 USAGE 만
-- 있으면 된다 — 즉 테이블 INSERT 권한이 하나도 없어도 id 카운터를 임의로 되감거나
-- 앞으로 튀길 수 있다. 당장 PostgREST 가 시퀀스를 직접 노출하지는 않지만,
-- "anon 은 public 에 대해 권한이 0" 이라는 20260802000005 의 원칙에는 구멍이다.

revoke usage, select, update on all sequences in schema public from anon, authenticated;

-- 상시 재개방 차단은 테이블과 동일한 논리다: ALTER DEFAULT PRIVILEGES 는 "누가
-- 만들었냐" 별로 걸리므로, 이 마이그레이션을 실행하는 롤(postgres)이 앞으로
-- 만드는 시퀀스에만 적용된다 — 이미 존재하는 8개에는 위 revoke 가, 앞으로 생길
-- identity 컬럼용 시퀀스에는 아래 한 줄이 맡는다. 블랭킷 보장이 아니라 가드일 뿐이다.
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- service_role 은 여기서 이름이 언급되지 않으므로 20260725000001 의
-- `grant all on all sequences in schema public to service_role` 은 그대로 유지된다
-- (ingest·apps/web 서버 쪽 identity 컬럼 insert 는 계속 동작해야 한다 — Step 2 에서 실측 확인).
