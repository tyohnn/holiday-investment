-- financial_facts → Storage 반출을 준비하는 테이블 2개.
--
-- 배경: financial_facts(13,920,062행 · 4,374 MB)를 Storage 로 내리는 계획이 있다.
-- 반출한 객체를 되읽어 원본과 대조할 스테이징 자리(financial_facts_restore_check)와,
-- 원본이 DB 에서 사라진 뒤에도 "어느 회사분이 어디로 갔는지" 알 수 있는 매니페스트
-- (fin_archive)가 필요하다. 이 마이그레이션은 DDL 만 담는다 — 데이터를 채우는 문장은
-- 없다(반출·대조·백필은 별도 오프라인 도구의 몫이다).

-- ─────────────────────────────────────────────── 1. financial_facts_restore_check
--
-- Storage 객체를 되읽어 이 테이블에 넣고 financial_facts 와 대조하는 스테이징 자리.
--
-- ★ `like financial_facts including all` 로 만드는 이유: financial_facts.natural_key 는
-- 17개 컬럼을 이어붙여 sha256 한 `generated always as (...) stored` 컬럼이다
-- (20260803000002_financial_facts_quarterly_amounts.sql). 이 대조가 성립하려면 두 테이블의
-- natural_key 생성식이 글자 하나도 다르지 않아야 한다 — 손으로 컬럼을 베끼면 그 보장이
-- 사라지고, 생성식이 미묘하게 갈리면 대조 자체가 거짓 일치/거짓 불일치를 낼 수 있다.
-- `including all` 은 생성 컬럼 식·기본값(identity 포함)·인덱스·통계·스토리지·코멘트까지
-- 전부 복제하므로, 이 테이블은 financial_facts 의 사본이 아니라 **파생**이다 — 원본의
-- 정의가 바뀌면(마이그레이션으로) 이 문장을 다시 실행해 재생성해야 같이 바뀐다.
--
-- LIKE 가 복제하지 않는 것(문서화된 동작, 의도적으로 그대로 둔다):
--   - 외래키 제약(corp_code → companies) — 스테이징 테이블이 참조 무결성을 강제할
--     필요는 없다. 대조가 끝나면 비우는 임시 자리다.
--   - RLS 활성화 여부·grant — 아래에서 이 마이그레이션이 직접 잠근다.
--   - 트리거 — 원본에 트리거가 없으므로 해당 없음.
--
-- identity 컬럼(id)은 including identity 로 속성만 복제되고 **독립된 새 시퀀스**를 받는다
-- (원본 financial_facts_id_seq 와 공유하지 않는다) — 아래에서 그 시퀀스도 잠근다.
create table financial_facts_restore_check (like financial_facts including all);

comment on table financial_facts_restore_check is
  'financial_facts → Storage 반출 대조용 스테이징. Storage 객체를 되읽어 여기 적재한 뒤 '
  'financial_facts 와 natural_key 로 맞춰본다. `like financial_facts including all` 로 만들어 '
  '생성 컬럼 식(natural_key)이 원본과 한 글자도 다르지 않음을 DDL 이 보장한다 — 대조 로직이 '
  '아니라 스키마 자체가 그 보장의 근거다. 대조가 끝나면 비운다(원장이 아니라 작업대).';

-- ─────────────────────────────────────────────── 2. fin_archive
--
-- 반출 매니페스트 — 회사당 1행, 약 2,659행 예상. 원본이 DB 에서 사라진 뒤에는
-- "어느 회사 객체가 빠졌는지 / 얼마나 빠졌는지 / 검증됐는지"를 알 방법이 이 표뿐이다.
create table fin_archive (
  corp_code           text primary key references companies on delete restrict,
  -- restrict: companies 행이 지워져도 반출 기록은 남아야 한다(참조가 끊기면 안 되는
  -- 감사 기록에 가깝다) — financial_facts 의 on delete cascade 와 의도적으로 다르다.

  storage_path        text not null unique,
  -- Storage 객체 경로(버킷 내 key). 회사당 객체 하나라는 전제이므로 unique.

  row_count           bigint not null check (row_count >= 0),
  -- 반출 시점에 그 회사에서 financial_facts 로부터 뽑아낸 행 수.

  natural_key_fingerprint text not null,
  -- 그 회사 natural_key 를 오름차순 정렬한 목록 전체의 지문(sha256, hex 64자) —
  -- 대조의 축. financial_facts 가 사라진 뒤에도 "반출된 행 집합이 원본과 같았다"를
  -- 재확인하려면 개별 행이 아니라 이 지문과 대조해야 한다(개별 natural_key 를 전부
  -- 여기 보관하면 매니페스트가 아니라 사실상 원본 복제가 된다 — 지문 하나로 축약한다).
  -- 계산 방식은 반출 도구가 정하되, natural_key 정렬 순서와 인코딩(hex/raw)을
  -- 대조 시점에도 동일하게 재현할 수 있어야 한다 — 방식이 바뀌면 이 컬럼의 의미도
  -- 바뀌므로 반출 도구 쪽에 방식을 고정해 문서화해 둘 것.

  object_bytes         bigint not null check (object_bytes >= 0),
  -- Storage 에 실제로 적재된 객체 크기(압축 후, 바이트).

  uncompressed_bytes    bigint not null check (uncompressed_bytes >= 0),
  -- 압축 전 크기(바이트) — 압축비 추적, 복원 시 예상 메모리 사용량 추정용.

  archived_at          timestamptz not null default now(),
  -- 반출(Storage 적재) 시각.

  verified_status      text not null default 'archived'
    check (verified_status in ('archived', 'verified', 'failed')),
  -- 'archived': 반출만 됨(아직 대조 안 함) | 'verified': financial_facts_restore_check
  -- 경유 대조까지 끝나 일치 확인됨 | 'failed': 대조했는데 불일치 발견 — financial_facts
  -- 에서 이 회사분을 지우면 안 된다는 신호.

  verified_at          timestamptz
  -- 대조가 끝난 시각. verified_status='archived' 인 동안은 NULL.
);

comment on table fin_archive is
  'financial_facts → Storage 반출 매니페스트. 회사당 1행. 원본 행이 financial_facts 에서 '
  '삭제된 뒤에는 "어느 회사가 반출됐고 어디 있으며 검증됐는지"를 아는 유일한 표다 — '
  '이 표를 지우면 그 지식이 통째로 사라진다.';

alter table financial_facts_restore_check enable row level security;
alter table fin_archive enable row level security;
-- 두 테이블 모두 permissive 정책을 하나도 만들지 않는다 — anon/authenticated 는
-- 기본 거부(20260802000005 의 원칙과 동일).

-- 거부는 두 겹(20260802000004/000005 의 원칙) — RLS 뿐 아니라 role grant 도 명시적으로
-- 회수한다. 호스티드 Supabase 는 public 스키마 신규 테이블에 anon·authenticated 에게
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 7개를 자동으로 얹는다 —
-- 로컬 스택은 이 동작을 재현하지 않으므로 반드시 호스티드에서 실측 검증해야 한다.
-- TRUNCATE 는 RLS 로 걸러지지 않는 점도 20260802000004 와 동일하게 유의.
revoke select, insert, update, delete, truncate, references, trigger
  on financial_facts_restore_check, fin_archive
  from anon, authenticated;

-- financial_facts_restore_check.id 의 identity 컬럼이 만든 새 시퀀스도 잠근다
-- (20260802000006 의 구멍 — 시퀀스는 릴레이션이 아니라 별도 객체라 위 revoke 에 안 걸린다).
-- 이미 존재하는 시퀀스들에는 영향이 없다(이미 0건 — 다시 회수해도 무해).
revoke usage, select, update on all sequences in schema public from anon, authenticated;

-- public 스키마에 함수를 만들지 않는다 — PostgREST /rpc 표면을 늘리지 않기 위해서다
-- (20260803000002 가 같은 이유로 사용자 함수 대신 extensions.digest 를 쓴 것과 동일한 원칙).
-- `alter default privileges in schema public revoke all on tables/sequences from anon,
-- authenticated`(20260802000005/000006)가 이미 걸려 있어 이 마이그레이션이 만드는 신규
-- 객체는 애초에 자동 grant 를 받지 않는다 — 위 revoke 문들은 그 원칙 그대로 "두 겹"을
-- 명시적으로 다시 한 번 확인해 두는 것이다(fin_periods, 20260806000001 과 동일한 패턴).
