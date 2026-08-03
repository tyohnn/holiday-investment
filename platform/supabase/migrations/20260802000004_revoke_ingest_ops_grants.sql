-- ingest_corps/ingest_progress/ingest_api_quota 를 anon/authenticated 기본 권한에서 회수.
--
-- 배경: 20260802000002 는 "anon/authenticated 에게 grant 를 주지 않으면 접근이 거부된다"고
-- 가정하고 이 세 테이블에 RLS만 켠 채 anon/authenticated grant 문을 아예 쓰지 않았다.
-- 그 가정은 로컬 스택(supabase start)에서는 참이라 로컬 검증은 깨끗이 통과했다.
--
-- 하지만 호스티드 Supabase 프로젝트는 다르다: public 스키마의 신규 테이블은 마이그레이션이
-- 명시적으로 grant 하지 않아도 플랫폼이 미리 걸어둔 default privileges 로 인해
-- anon·authenticated 에게 SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 를
-- 자동으로 받는다 — "우리가 grant 를 안 줬다"가 "거부된다"를 뜻하지 않는다.
--
-- 실제로 호스티드 DB에서 `information_schema.role_table_grants` 를 확인해보니 세 테이블
-- 모두 anon/authenticated 가 위 7개 권한을 전부 들고 있었다. RLS 는 켜져 있고 permissive
-- 정책이 없으니 실제 행 유출(anon 쿼리가 200 [] 를 반환)은 없었지만, 방어선이 "정책 없음"
-- 한 겹뿐이었다 — 나중에 누군가 permissive 정책을 하나 추가하면 grant 는 이미 있으니
-- 그 순간 바로 공개된다.
--
-- 20260802000001 이 analyses·trackings 에 했던 것과 같은 원칙: 거부는 반드시 두 겹이어야
-- 한다 — (1) permissive 정책 없음 AND (2) role grant 없음. 한 겹만으로는 실수 한 번에
-- 공개로 뒤집힌다. 이 마이그레이션은 두 번째 겹을 채운다.
--
-- 교훈: 로컬 스택은 이 default privileges 동작을 재현하지 않는다. RLS 를 로컬에서만
-- 검증하고 통과했다고 안심하면 안 된다 — 실제 배포 대상(호스티드)에서 검증해야 한다.

revoke select, insert, update, delete, truncate, references, trigger
  on ingest_corps, ingest_progress, ingest_api_quota
  from anon, authenticated;

-- RLS 는 계속 켜진 상태로 둔다(20260802000002 에서 이미 enable, permissive 정책 없음).
-- service_role 권한은 손대지 않는다 — 20260802000002 의 grant 가 그대로 유효하다.
