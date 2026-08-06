-- filing_docs 확장: 공시 원문을 로컬 디스크가 아니라 Supabase Storage 로 보내기 위한
-- 매니페스트 컬럼 추가.
--
-- 배경: Phase 3(공시 원문)를 docs/<corp_code>/<rcept_no>.zip 경로로 Storage 에 올리도록
-- 바꾼다. DART 원본 ZIP 바이트 그대로 올라가므로, filing_docs 가 "어느 공시 원문이
-- Storage 어디에 있는가"의 매니페스트 역할을 겸해야 한다.
--
-- 기존 컬럼(file_name/n_files/n_sections/bytes/status/fetched_at)은 로컬 시드 1,426건에
-- 이미 값이 있고 의미가 확정돼 있으므로 손대지 않는다 — add column if not exists 로만
-- 확장하고, 기존 컬럼을 지우거나 개명하지 않는다.

alter table filing_docs
  add column if not exists storage_path text,
  add column if not exists zip_bytes bigint check (zip_bytes >= 0),
  add column if not exists zip_sha256 text check (zip_sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists sections_extracted_at timestamptz;

-- storage_path 는 "그 rcept_no 의 원문이 실제로 어디 있는가"를 담는 유일한 컬럼이다.
-- rcept_no 당 객체 하나라는 설계이므로 unique 로 오적재(다른 rcept_no 가 같은 객체를
-- 가리키는 사고)를 DB 가 잡아낸다. 값이 아직 없는 기존 1,426행은 NULL 로 남고, unique
-- 제약은 NULL 여러 개를 허용하므로 문제 없다.
alter table filing_docs
  add constraint filing_docs_storage_path_unique unique (storage_path);

comment on column filing_docs.storage_path is
  'Storage 버킷 내 객체 key, 예: docs/<corp_code>/<rcept_no>.zip. 아직 업로드 안 된 행은 NULL.';

comment on column filing_docs.zip_bytes is
  '업로드한 DART 원본 ZIP 전체의 바이트 수. 기존 bytes 컬럼(zip 내부 "대표 문서" 하나의 '
  '크기)과 의미가 다르다 — bytes 는 zip 을 열어본 뒤에야 알 수 있는 대표 파일 크기이고, '
  'zip_bytes 는 zip 자체(Storage 업로드 대상)의 크기다. zip 안에 파일이 여럿이면(n_files > 1) '
  '두 값은 서로 다른 것이 정상이다.';

comment on column filing_docs.zip_sha256 is
  '업로드한 ZIP 바이트의 sha256(hex 64자). Storage 반출 후 무결성 대조축 — '
  'financial_facts natural_key 지문(fin_archive.natural_key_fingerprint, 20260806000002 참고)과 '
  '같은 규율이다: 업로드 전 계산한 값과 Storage 에서 되읽어 계산한 값을 이 컬럼과 대조해 '
  '왕복 무결성을 확인한다.';

comment on column filing_docs.sections_extracted_at is
  '이 rcept_no 에서 filing_sections 추출이 실제로 실행된 시각. 섹션 본문은 관심종목만 DB 에 '
  '넣으므로 "원문(zip)은 있는데 섹션은 아직 안 뽑았다"가 정상 상태다. n_sections IS NULL 로 '
  '그 여부(추출했는지 여부)는 이미 구분되지만 — 값이 있으면 추출 완료, NULL 이면 미추출,'
  '0 이면 추출을 시도했으나 섹션이 없었던 경우로 셋이 구분된다 — n_sections 는 시각을 담지 '
  '않는다. 이 컬럼이 그 시각을 담는다. 미추출 행은 NULL.';

comment on table filing_docs is
  '공시 원문 zip 이 어디 있는지의 매니페스트. rcept_no 당 1행. file_name/n_files/bytes 는 zip '
  '내부(대표 문서) 메타이고, storage_path/zip_bytes/zip_sha256 은 zip 자체(Storage 객체) 메타다. '
  'n_sections/sections_extracted_at 은 그 원문에서 filing_sections 을 얼마나/언제 뽑았는지를 '
  '담는다 — 관심종목이 아니면 원문은 있어도 섹션은 계속 비어 있는 것이 정상이다.';

-- RLS·grant 는 건드리지 않는다. filing_docs 는 20260802000005_lock_all_to_service_role.sql
-- 로 이미 RLS 활성 + permissive 정책 0개 + anon/authenticated grant 회수(두 겹) 상태다.
-- ALTER TABLE ADD COLUMN 은 기존 릴레이션의 RLS·권한 설정을 바꾸지 않으므로 이 마이그레이션은
-- grant/revoke 문을 쓰지 않는다 — 그대로 service_role 전용을 유지한다(호스티드에서 실측 검증).
