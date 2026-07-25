-- 스키마 v0 — P-A 파일럿 가설. 로드맵 "P-A 설계 유보 사항"에 따라 계속 깎는다.
-- 원칙: 자주 쿼리하는 축은 컬럼으로, 롱테일 필드는 payload(jsonb)로. 원본 API 응답을
-- 잃지 않는다(재적재 없이 컬럼 승격 가능). 모든 적재는 스코프 교체(delete+insert) 또는
-- upsert 로 멱등이다.

-- ───────────────────────────── 기업
create table companies (
  corp_code    text primary key,          -- DART 고유번호 (8자리)
  name         text not null,
  stock_code   text unique,               -- 6자리 종목코드
  market       text,                      -- KOSPI | KOSDAQ | KONEX
  sector_code  text,                      -- 업종코드 (induty_code)
  fiscal_month int,                       -- 결산월
  ceo          text,
  established  date,
  profile      jsonb,                     -- company.json 원본
  updated_at   timestamptz not null default now()
);

-- ───────────────────────────── 공시 메타 (전 역사)
create table filings (
  rcept_no      text primary key,         -- 접수번호 (전역 유일)
  corp_code     text not null references companies on delete cascade,
  report_nm     text not null,
  flr_nm        text,                     -- 제출인
  rcept_dt      date not null,
  rm            text,                     -- 비고 (유/코/정 등)
  is_correction boolean not null default false,  -- 제목 [기재정정] 여부
  corrects_rcept_no text                  -- 정정 대상 원본 (식별 가능할 때만)
);
create index filings_corp_dt on filings (corp_code, rcept_dt desc);
create index filings_correction on filings (corp_code) where is_correction;

-- ───────────────────────────── 재무제표 전 계정 (fnlttSinglAcntAll, 2015~)
create table financial_facts (
  id          bigint generated always as identity primary key,
  corp_code   text not null references companies on delete cascade,
  bsns_year   int  not null,
  reprt_code  text not null,              -- 11011 연간 | 11013 1Q | 11012 반기 | 11014 3Q
  fs_div      text not null,              -- CFS 연결 | OFS 별도 (요청 기준)
  sj_div      text not null,              -- BS | IS | CIS | CF | SCE
  account_id  text,
  account_nm  text not null,
  amount      numeric,                    -- 당기 (원)
  amount_prev numeric,                    -- 전기
  amount_prev2 numeric,                   -- 전전기
  ord         int,
  currency    text,
  rcept_no    text                        -- 출처 보고서 — 정정 감지 축
);
create index ff_lookup on financial_facts (corp_code, bsns_year, reprt_code, sj_div);
create index ff_account on financial_facts (corp_code, account_nm);

-- ───────────────────────────── 정기보고서 주요정보 (배당·최대주주·직원 등 12항목)
create table report_items (
  id        bigint generated always as identity primary key,
  corp_code text not null references companies on delete cascade,
  bsns_year int  not null,
  item      text not null,                -- 배당 | 증자 | 자기주식 | 최대주주 | … | 감사의견
  payload   jsonb not null,               -- 응답 행 원본
  rcept_no  text
);
create index ri_lookup on report_items (corp_code, item, bsns_year);

-- ───────────────────────────── 주요사항보고서 (유증·CB·자사주·소송 등 10종)
create table events (
  id         bigint generated always as identity primary key,
  corp_code  text not null references companies on delete cascade,
  event_type text not null,               -- 유상증자결정 | 전환사채발행결정 | …
  rcept_no   text,
  rcept_dt   date,
  payload    jsonb not null
);
create index ev_lookup on events (corp_code, event_type, rcept_dt desc);
create index ev_date on events (rcept_dt desc);          -- 크로스 종목 "최근 유증" 쿼리용

-- ───────────────────────────── 지분공시 (대량보유·임원 소유보고)
create table ownership_txns (
  id        bigint generated always as identity primary key,
  corp_code text not null references companies on delete cascade,
  kind      text not null,                -- majorstock | elestock
  rcept_no  text,
  rcept_dt  date,
  payload   jsonb not null
);
create index own_lookup on ownership_txns (corp_code, kind, rcept_dt desc);

-- ───────────────────────────── 사실 시계열 원장 (B안 실험 — A2에서 md 방식과 비교 판정)
create table trackings (
  id          bigint generated always as identity primary key,
  corp_code   text not null references companies on delete cascade,
  topic       text not null,              -- 자금조달-지분희석 등 (분류 vs 태그는 미결)
  fact_date   date not null,              -- 사실의 시점
  fact        text not null,              -- 사실 서술 (해석 금지)
  value_text  text,                       -- 수치 (표기 그대로)
  source      text not null,              -- 출처 서술
  rcept_no    text,                       -- 공시발이면 접수번호
  recorded_at timestamptz not null default now()
  -- append-only 원장: UPDATE/DELETE 하지 않는다 (정정도 새 행으로)
);
create index tr_lookup on trackings (corp_code, topic, fact_date);

-- ───────────────────────────── 분석 판정 이력 (manifest.분석 의 DB 화)
create table analyses (
  id          bigint generated always as identity primary key,
  corp_code   text not null references companies on delete cascade,
  analyzed_on date not null,
  mode        text not null,              -- 기본 | 심층
  fair_price  bigint,                     -- 낙점 적정주가 (원)
  upside_pct  numeric,                    -- 상승여력 %
  entry_price bigint,                     -- 진입가 (원)
  margin_ok   boolean,                    -- 안전마진(200%) 충족
  report_path text,
  valuation   jsonb,                      -- valuation.json 원본
  unique (corp_code, analyzed_on, mode)
);

-- ───────────────────────────── 접근 정책: 공개 데이터 읽기 허용, 쓰기는 service_role 만
-- (DART 공시는 공공데이터. P-C 크레딧 단계에서 트래킹·분석에 대한 정책을 세분화한다)
do $$
declare t text;
begin
  foreach t in array array['companies','filings','financial_facts','report_items',
                           'events','ownership_txns','trackings','analyses'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;

-- 명시적 권한 (CLI 버전에 따라 기본 권한이 다르므로 마이그레이션이 직접 보장한다)
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
