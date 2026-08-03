-- 백필 오케스트레이터 상장상태 게이트 — company 단계에서 이미 관측한 corp_cls 를 재사용해
-- filings/fin/phase2·3 단계가 "상장폐지·비상장으로 이미 확인된" 회사에 API 콜을 낭비하지 않게 한다.
--
-- 배경(조사 완료, 재조사 불필요): corpCode.xml 의 stock_code 는 "한때 배정된 종목코드"일 뿐
-- "지금 거래 중"을 보장하지 않는다(3,978개 stock_code 보유 법인 중 상당수가 상장폐지). modify_date
-- 도 대용 지표로 못 쓴다(2026년 갱신 15건 표본 중 3건이 이미 상장폐지, 2017년 갱신 표본은 15/15
-- 상장폐지). 반면 OpenDART company.json 의 corp_cls 필드는 30개 표본 전량에서 모순 없이 생사를
-- 갈랐다 — Y(코스피)/K(코스닥)/N(코넥스) 는 생존, E(기타법인=비상장·상장폐지 등) 는 사망.
-- platform/ingest/ingest.py 의 load_company() 는 이미 corp_cls 를 읽어 market(KOSPI/KOSDAQ/KONEX)
-- 으로 변환해 쓰지만, 원본 값 자체는 어디에도 남기지 않았다 — 이 마이그레이션이 그 자리를 만든다.
--
-- 이 값으로 뭘 하는가(로직은 platform/ingest/backfill.py 에 있다, 여기는 저장소만): company 단계가
-- 성공하면 raw corp_cls 를 이 컬럼에 적어두고, 이후 filings/fin/items/events/regs/ownership/docs
-- 단계를 고를 때 corp_cls 가 {Y,K,N} 밖(=E 등)인 회사는 건너뛴다(ingest_progress.status='skipped').
-- corp_cls 가 아직 NULL(= company 단계 미실행, "모른다")인 회사는 절대 게이트하지 않는다 —
-- "모른다"가 조용히 "건너뛴다"가 되면 안 된다는 게 이 설계의 핵심 불변식이다.
--
-- 왜 boolean 이 아니라 raw text 인가: "지금 아는 것"만 반영하는 boolean 은 나중에 판단을 되짚어볼
-- 수가 없다. K/N 처럼 서로 다른 시장을 뭉뚱그리지 않고 어느 시장이었는지 남겨야, 나중에 게이트
-- 기준을 바꾸고 싶을 때(예: N 코넥스는 제외하자) 재조회 없이 바로 재계산할 수 있다.

-- ───────────────────────────── ingest_corps: 원본 corp_cls 보관
alter table ingest_corps add column corp_cls text;

comment on column ingest_corps.corp_cls is
  'DART company.json 원본 corp_cls 코드 그대로(Y=코스피,K=코스닥,N=코넥스,E=기타/비상장 등, '
  'DART 가 새 코드를 추가해도 그대로 통과시킨다 — CHECK 로 제한하지 않음). '
  'NULL = company 단계가 아직 실행되지 않아 상장상태를 모름(게이트 미적용, "모름"≠"건너뜀"). '
  'company 단계 성공 시 backfill.py 가 채운다. Y/K/N 이 아닌 값은 filings/fin/phase2·3 단계에서 '
  '게이트로 skipped 처리된다(--include-delisted 로 우회 가능, 판단은 언제든 재검토 가능).';

-- 조회 편의용(운영 중 "몇 개가 게이트 대상인가" 같은 임시 질의에 사용, 백필 로직 자체는
-- corp_code 배치로 ingest_corps 를 조회하므로 이 인덱스에 의존하지 않는다).
create index ingest_corps_corp_cls on ingest_corps (corp_cls) where corp_cls is not null;

-- 이미 company 단계가 done 으로 끝난 회사는 companies.profile(JSONB)에 원본 API 응답이 이미
-- 저장돼 있다 — DART 를 다시 부르지 않고 여기서 그대로 채워 넣는다(쿼터 절약이 이 프로젝트 전체의
-- 운영 원칙이라 이미 가진 데이터를 또 부르는 건 사고에 가깝다).
update ingest_corps ic
set corp_cls = c.profile ->> 'corp_cls'
from companies c
where c.corp_code = ic.corp_code
  and c.profile ? 'corp_cls'
  and ic.corp_cls is null;

-- ───────────────────────────── ingest_progress: 'skipped' 상태 추가
-- done(실제로 끝남)도 failed(뭔가 실패함)도 아닌 세 번째 종결 상태 — "게이트가 판단해서 이 단계를
-- 아예 시도하지 않았다". attempts/calls_spent 는 건드리지 않는다(회사 데이터의 실패가 아니므로
-- 소모 취급 안 함 — 기존 mark_pending 의 관례와 동일). last_error 자리를 재사용해 게이트 사유
-- (corp_cls 값)를 남긴다.
alter table ingest_progress drop constraint ingest_progress_status_check;
alter table ingest_progress add constraint ingest_progress_status_check
  check (status in ('pending', 'running', 'done', 'failed', 'skipped'));

-- ───────────────────────────── RLS: 새 컬럼·새 status 값 모두 기존 정책 범위 안
-- ingest_corps/ingest_progress 는 20260802000002 에서 이미 RLS 를 켰고 permissive 정책을 하나도
-- 만들지 않았다(= anon/authenticated 전면 거부, service_role 만 grant). 이 마이그레이션은 그
-- 두 테이블에 컬럼을 추가하고 값을 채울 뿐 새 테이블을 만들지 않으므로 grant 문이 전혀 필요
-- 없다 — 컬럼 단위 grant 라는 게 없고(Postgres 의 테이블 grant 는 이후 추가되는 컬럼에도 그대로
-- 적용된다), 20260802000002 의 `grant ... to service_role` 이 이미 이 두 테이블 전체를 덮는다.
-- ★ 절대 여기서건 이후 마이그레이션에서건 `grant select on ingest_corps/ingest_progress to anon`
-- 같은 문구를 추가하지 말 것 — 0001(20260725000001_schema_v0.sql)의
-- `grant select on all tables in schema public to anon, authenticated;` 블랭킷 grant 를 새
-- 마이그레이션에 복붙해서 운영 테이블이 조용히 다시 뚫린 사고가 이미 한 번 있었다
-- (20260802000001_restrict_private_relations.sql, 브랜치 feat/omd-notion-ssot-and-rls-lockdown).
-- 이 파일과 20260802000002 의 같은 경고를 반드시 먼저 읽을 것.
