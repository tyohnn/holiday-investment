-- 백필 오케스트레이터 체크포인트 — P-B 2단계(전 상장사 배치 적재)의 이어달리기·쿼터 장부.
--
-- 배경: ingest.py 는 회사 1개를 처리하는 스크립트다(중단·재개 개념이 없음). 2,700여
-- 상장사를 순회하려면 (a) 어느 회사의 어느 단계까지 끝났는지, (b) 오늘 키별로 몇 콜을
-- 썼는지를 DB에 남겨야 크래시·쿼터 소진 후에도 이어서 돌릴 수 있다. platform/ingest/backfill.py
-- 가 이 세 테이블을 읽고 쓴다.
--
-- 세 테이블:
--   ingest_corps    — corpCode.xml 에서 뽑은 상장사(종목코드 보유) 전체 큐. `companies` 와는
--                      별개다 — `companies` 는 "실제로 적재까지 끝난" 회사만 있어야 하는데
--                      (apps/web 이 그대로 노출), 시딩 시점엔 아직 회사 정보(company 단계)조차
--                      돌지 않았으므로 여기 스텁을 넣으면 안 된다.
--   ingest_progress — (corp_code, stage) 단위 체크포인트. 8단계
--                      (company/filings/fin/items/events/regs/ownership/docs) 각각 독립.
--                      pending→running→done|failed. done 이면 재실행 시 API 콜을 전혀
--                      쓰지 않고 건너뛴다 — "재실행하면 472콜 또 나간다" 문제의 해결책.
--   ingest_api_quota — (키 지문, 날짜) 별 오늘 사용 콜 수 + 소진 여부. 여러 키를 라운드로빈할
--                      때 어느 키가 오늘 한도(020) 를 맞았는지 기억해야 한다.
--
-- ★★★ 이 테이블들은 절대 anon 이 읽으면 안 되는 내부 운영 테이블이다 ★★★ (오류 메시지·재시도
-- 횟수·키 지문·회사 큐 진행률은 DART 공시 같은 공공데이터가 아니다 — 운영 정보 유출이다).
-- RLS 를 켜고 permissive 정책은 하나도 만들지 않는다 → anon/authenticated 는 기본 거부.
-- service_role 만 명시적으로 grant 한다(RLS 를 우회하는 service_role 도 "테이블 권한" 자체는
-- 별도로 필요하다 — 0001(20260725000001_schema_v0.sql)의 `grant all ... to service_role` 은
-- "그 시점에 존재하던 테이블"에만 적용되고 나중에 생기는 이 테이블들엔 적용되지 않는다).
--
-- ⚠ 주의(20260802000001_restrict_private_relations.sql, 브랜치 feat/omd-notion-ssot-and-rls-lockdown
-- 에서 이미 겪은 실수): 0001 이 깔아둔
--   `grant select on all tables in schema public to anon, authenticated;`
-- 는 실행 시점 기준 "스키마의 모든 테이블"을 대상으로 하는 블랭킷 grant 다. 이 마이그레이션이
-- 나중에 실행되므로 이 세 테이블은 자동으로는 노출되지 않지만, **앞으로 누군가 새 테이블을
-- 추가하며 이 블랭킷 grant 패턴을 다시 복붙하면 이 운영 테이블들도 조용히 다시 뚫린다.**
-- 새 마이그레이션에서 "grant select on all tables in schema public to anon" 같은 문구를
-- 쓰기 전에 반드시 이 파일과 20260802000001 을 먼저 볼 것 — 편의 때문에 운영 테이블까지
-- anon 에게 열어주는 사고가 이미 한 번 있었다.

-- ───────────────────────────── 상장사 큐 (corpCode.xml, 종목코드 보유만)
create table ingest_corps (
  corp_code  text primary key,        -- DART 고유번호 (8자리)
  corp_name  text not null,
  stock_code text not null unique,    -- 6자리 종목코드 — CLI 는 이 코드로 회사를 지정한다
  seeded_at  timestamptz not null default now()
);

-- ───────────────────────────── (회사, 단계) 체크포인트
create table ingest_progress (
  corp_code    text not null references ingest_corps (corp_code) on delete cascade,
  stage        text not null check (stage in
                 ('company', 'filings', 'fin', 'items', 'events', 'regs', 'ownership', 'docs')),
  status       text not null default 'pending' check (status in
                 ('pending', 'running', 'done', 'failed')),
  attempts     int not null default 0,       -- 실패로 끝난 횟수만 센다 (키 소진 재대기열은 안 셈 —
                                              -- 쿼터 초과는 이 회사 데이터의 문제가 아니므로 소모 취급 안 함)
  last_error   text,                         -- 가장 최근 실패 사유 (transient 도 상태코드 포함)
  calls_spent  int not null default 0,       -- 이 단계가 지금까지 실측 소비한 호출수(관측치, 예산 계획용)
  started_at   timestamptz,                  -- running 진입 시각 — 오래된 running 은 재시작 시 회수 대상
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (corp_code, stage)
);

-- phase/stage 별 진행률 집계, status 명령의 기본 조회 패턴
create index ingest_progress_stage_status on ingest_progress (stage, status);
-- 크래시로 running 에 멈춘 행을 나이 기준으로 회수(reclaim)할 때 쓰는 부분 인덱스
create index ingest_progress_running_age on ingest_progress (started_at) where status = 'running';

-- ───────────────────────────── 키별·날짜별 호출 카운터 (쿼터 회계)
create table ingest_api_quota (
  key_id     text not null,           -- sha256(API 키)[:12] 지문 — 원본 키 문자열은 저장하지 않는다
  quota_date date not null,
  calls_used int not null default 0,
  exhausted  boolean not null default false,  -- OpenDART status=020("요청 제한 초과") 관측 시 true
  updated_at timestamptz not null default now(),
  primary key (key_id, quota_date)
);

-- ───────────────────────────── RLS: 켜기만 하고 permissive 정책은 만들지 않는다 (= 전면 거부)
alter table ingest_corps     enable row level security;
alter table ingest_progress  enable row level security;
alter table ingest_api_quota enable row level security;

-- anon/authenticated 에게는 그 어떤 select/insert/update/delete grant 도 주지 않는다(의도적 누락).
-- service_role 만 명시적으로 전체 권한을 받는다 — ingest/backfill.py 가 SUPABASE_SERVICE_KEY 로
-- PostgREST 를 호출하므로 이 세 테이블에 대한 실동작 권한은 여기서만 나온다.
grant select, insert, update, delete on ingest_corps, ingest_progress, ingest_api_quota
  to service_role;

-- 참고: 세 테이블 모두 PK 가 text/복합키라 identity 시퀀스가 없다 — 시퀀스 grant 불필요.
