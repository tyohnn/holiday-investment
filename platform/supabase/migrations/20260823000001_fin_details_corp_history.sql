-- 공시 원문 추출 사실 2테이블: fin_details(수치, long) + corp_history(연혁, 비수치).
--
-- DDL 만 담는다 — 데이터 적재는 별도 스킬(plugin/skills/company-profile-extract/, 미착수)의
-- 몫이다(fin_archive 패턴과 동일: "이 마이그레이션은 DDL 만 담는다"). 스키마는 삼성전자
-- 파일럿(00126380, rcept_no 20260310002820 등 2개 사업보고서, 규칙 기반 파서, DB 쓰기 없음)
-- 으로 실측 확정했다 — 근거 전문은 리서치 스크래치패드의 `fnguide-추출-계획.md`(§2 신규
-- 2테이블 스키마)와 `pilot-samsung-report.md`(§4 long 테이블 스키마에 대한 함의) 참고.
--
-- 파일럿이 실측으로 확인한 것 (이 스키마가 그대로 반영한 이유):
--   1. 표시 기준이 개념 하나에 여러 개일 수 있다 — R&D 총액에서 FnGuide 가 세전/세후를
--      섞어 쓰는 게 실측됐다(2023년만 세후, 나머지 3개년은 세전). value_basis 없이는
--      이 불일치를 설명조차 할 수 없었다.
--   2. "규칙 기반 불가"·"원문에 없음" 자체가 1급 레코드여야 한다 — 임원 지분처럼 사업보고서
--      본문에 대응 항목이 아예 없는 경우, amount 를 NULL 로 두고 status 에 사유를 적어야
--      다음 추출 시도(LLM 폴백이든 사람이든)가 같은 삽질을 반복하지 않는다.
--   3. 출처는 (rcept_no, 섹션, 표) 3단이 최소 단위다 — 자기주식 비율처럼 논리적 섹션("주주")과
--      실제 위치("회사의 개요")가 어긋나는 사례가 실측됐고, 한 섹션 안에 표가 여럿이라
--      섹션명만으로는 원문 대조가 안 됐다.
--   4. 보고서 회차마다 표 모양이 달라진다(같은 R&D 행이 최신 보고서는 1행, 직전 보고서는
--      2행으로 쪼개져 있었다) — "이번 회차에서 통과한 파서가 다음 회차에도 통과한다"는
--      보장이 없으므로, source_rcept_no 를 유니크 축에 반드시 넣어 회차별 이력을 남긴다.

-- ─────────────────────────────────────────────── 1. fin_details — 수치 사실 long 테이블
--
-- report_items/events/ownership_txns(20260725000001)와 같은 형태를 따른다: identity PK +
-- 자연키 유니크 제약 + 조회용 인덱스. fin_periods(20260806000001)처럼 자연키를 그대로
-- 복합 PK로 쓰지 않는 이유는 이 표가 fin_periods 와 달리 "1키 1행이 보장된 파생 계층"이
-- 아니라 report_items 부류처럼 **추출 시도마다 새 행이 쌓일 수 있는 사실 원장**이기
-- 때문이다(예: rule 추출 실패 후 llm 추출을 별도 extracted_by 행으로 재시도).
create table fin_details (
  id               bigint generated always as identity primary key,

  corp_code        text not null references companies on delete cascade,
  -- on delete 정책: fin_archive(20260806000002, restrict)가 아니라 financial_facts/
  -- report_items/events/ownership_txns(20260725000001, cascade)의 선례를 따른다.
  -- 근거: fin_archive 는 "원본이 DB 에서 사라진 뒤에도 남아야 하는 반출 감사 기록"이라
  -- restrict 가 맞지만, fin_details 는 그 반대다 — 원문(사업보고서)이 Storage 에 그대로
  -- 있는 한 재추출 비용이 DART 호출 0건이므로(계획 문서 §3), 회사 자체가 지워질 때 그
  -- 회사의 추출 사실을 붙들고 있을 감사적 이유가 없다. financial_facts 와 같은 성격의
  -- "회사에 종속된 재추출 가능 데이터"로 분류한다.

  period_key       text not null,
  -- '2025A' | '2026Q1' | 시점형이면 '2026-08-24' — fin_periods 의 period_key 관례를
  -- 재사용하되, 시점 스냅샷 성격의 개념(예: 주주현황 기준일)은 날짜 문자열도 허용한다.

  concept          text not null,
  -- 'segment_revenue_pct' | 'rnd_total' | 'market_share' | 'shareholding_pct' | ... —
  -- account_concepts 와 통합할지는 계획 문서 "미확정" 항목(§ 미확정)으로 남아 있어
  -- 이번 마이그레이션은 별도 어휘로 둔다(마이그레이션 범위 아님).

  item_name        text not null,
  -- 'DX' | 'DRAM' | '최대주주등' 등 부문·제품·계정·구분 이름. 개념 자체에 하위 항목이
  -- 없는 경우에도(예: rnd_total) 빈 문자열이 아니라 의미 있는 라벨(예: '전사')을 넣는다 —
  -- NULL 을 허용하지 않아 유니크 제약이 항상 유효하게 만든다.

  amount           numeric,
  -- NULL 허용 — "확인 불가"를 1급 레코드로 만든다(status 에 사유를 남기고 amount 는 비운다).
  -- 지어낸 값을 넣느니 NULL + status 로 남기는 쪽을 택한다(계획 문서 "LLM 규칙": 원문에
  -- 있는 숫자를 구조로 옮기는 것만 한다, 생성·보간 금지).

  unit             text,
  -- 'KRW' | 'pct' | '명' 등. amount 가 NULL 이면 unit 도 보통 NULL.

  value_basis      text,
  -- '세전' | '세후' | '반올림1자리' | '정밀계산' 등 — 같은 concept·item_name 의 표시
  -- 기준이 여러 개일 수 있음이 파일럿에서 실측됐다(R&D 총액 세전/세후 혼용). 이 필드가
  -- 없으면 같은 자연키에 서로 다른 기준의 값이 충돌해 유니크 제약을 위반하거나,
  -- 하나를 버려야 한다.

  status           text not null default 'ok',
  -- 'ok' | '확인불가:<사유>' — 예: '확인불가:원문에없음', '확인불가:보고서회차범위밖'.
  -- 파일럿의 임원 지분(사업보고서에 대응 표 자체가 없음), 2021년 R&D(대상 보고서 범위 밖)
  -- 사례가 이 상태로 기록되는 것을 전제한다.

  source_rcept_no  text references filings on delete cascade,
  -- filings 참조도 cascade — 20260725000004 의 filing_docs/filing_sections 가 이미
  -- `references filings on delete cascade` 선례를 세웠다(원본 filing 이 정정 등으로
  -- 지워지면 그 filing 을 가리키던 추출 사실도 같이 정리되는 쪽이 일관적이다).
  -- NULL 을 막지 않는 이유: '확인불가:원문에없음' 류 상태는 애초에 특정 rcept_no 하나로
  -- 환원되지 않을 수 있다(예: 여러 보고서를 확인했지만 어디에도 없었다는 결론).

  source_section   text,
  -- 섹션 제목(예: 'II. 사업의 내용'). 힌트가 아니라 감사 대상 — 자기주식 비율처럼
  -- 논리적 섹션과 실제 위치가 어긋나는 사례가 실측됐으므로 섹션명 자체를 그대로 저장한다.

  source_table     text,
  -- 표 이름/식별자까지 — 한 섹션에 표가 여럿이라 섹션만으로는 원문 대조가 안 됐다
  -- (계획 문서 §2 "★파일럿 추가"). source_section 과 함께 3단 출처의 마지막 단.

  extracted_by     text not null,
  -- 'rule' | 'llm:<모델명>' — 신뢰도 감사축. check 제약을 걸지 않는 이유: llm 뒤에 오는
  -- 모델명이 계속 바뀔 것이므로 CHECK IN (...) 화이트리스트를 매번 마이그레이션으로
  -- 갱신하게 만들지 않는다(운영 관례로 규율한다).

  extracted_at     timestamptz not null default now(),

  unique (corp_code, period_key, concept, item_name, source_rcept_no)
  -- 지시받은 유니크 그대로. value_basis 를 유니크 축에 넣지 않은 이유: 같은 자연키에
  -- 세전/세후 두 값이 "동시에 정답"인 경우는 파일럿에서 나오지 않았다(R&D 사례는 같은
  -- concept 안에서도 gross/net 을 별도 item_name 이나 별도 concept 으로 나눌 수 있다) —
  -- 적재 스킬이 실제로 같은 자연키에 두 value_basis 가 동시에 필요하다고 확인하면 그때
  -- value_basis 를 유니크에 추가하는 마이그레이션을 낸다. 지금 넣지 않는 이유는 과설계
  -- 방지: 원표 자체가 "이 항목의 정답은 하나"라는 전제(status 로 불확실성을 표현하는
  -- 설계)와 맞춘다.
);

comment on table fin_details is
  '공시 원문(사업보고서 등)에서 추출한 수치 사실의 long 테이블. 정형 재무의 정본이 아니다 — '
  '그건 fin_periods 다. 이 표는 fin_periods 컬럼으로 승격되지 않은, 회사 상세 화면에서만 '
  '쓰는 서술형·부문형·인용형 수치를 담는다(연구개발비, 부문별 매출비중, 시장점유율, '
  '주주현황 등). DDL 만 존재하며 데이터는 아직 없다 — 적재는 company-profile-extract '
  '스킬(미착수)의 몫이다.';

comment on column fin_details.status is
  '''ok'' 또는 ''확인불가:<사유>''. amount 가 NULL 이어도 행은 남는다 — "확인을 시도했고 '
  '실패했다"는 사실 자체가 재작업 방지에 값어치가 있다(파일럿: 임원 지분은 사업보고서에 '
  '대응 표가 아예 없었다).';

comment on column fin_details.value_basis is
  '세전/세후, 원문반올림/정밀계산 등 같은 concept·item_name 이 여러 표시 기준으로 등장할 '
  '때 구분하는 축. 파일럿 실측: 삼성전자 R&D 총액에서 FnGuide 표시값이 2023년만 세후('
  '"계"), 나머지 3개년은 세전("총계")과 일치했다 — 이 필드 없이는 그 불일치를 설명할 '
  '방법이 없었다.';

comment on column fin_details.source_table is
  '표 이름/식별자. source_section 만으로는 원문 대조가 안 된다 — 한 섹션에 표가 여럿인 '
  '경우가 실측됐다(예: "II. 사업의 내용" 안에 부문별 매출표와 시장점유율표가 함께 있음).';

-- 조회 인덱스: 회사 상세 화면은 "이 회사의 이 개념(들)"으로 조회한다(예: 회사 하나의
-- rnd_total 시계열, 또는 회사 하나의 segment_revenue_pct 전체). PK 가 identity 라 자연키
-- 선두 컬럼으로 자동 정렬되지 않으므로 별도 인덱스가 필요하다. 유니크 제약의 컬럼 순서
-- (corp_code, period_key, ...)는 "이 회사의 이 시점 전체"에 최적화돼 있어 "이 회사의 이
-- 개념 시계열"에는 맞지 않는다(period_key 가 선두라 concept 필터가 인덱스를 못 탄다) —
-- 그래서 (corp_code, concept) 을 별도로 둔다.
create index fd_corp_concept on fin_details (corp_code, concept);

alter table fin_details enable row level security;
-- permissive 정책을 만들지 않는다 — anon/authenticated 는 기본 거부
-- (20260802000005/000006 의 "거부는 두 겹" 원칙: RLS 정책 0개 + 아래 명시적 revoke).
revoke all on fin_details from anon, authenticated;
grant select, insert, update, delete on fin_details to service_role;
-- identity 시퀀스(fin_details_id_seq)도 잠근다 — 20260802000006 이 지적한 대로 시퀀스는
-- 릴레이션이 아니라 별도 객체라 위 revoke 에 걸리지 않는다. 호스티드의
-- `alter default privileges ... revoke all on sequences`(20260802000006)가 이미 신규
-- 시퀀스를 자동 잠그지만, "거부는 두 겹" 원칙에 따라 명시적으로 한 번 더 회수한다.
revoke usage, select, update on fin_details_id_seq from anon, authenticated;
grant usage, select on fin_details_id_seq to service_role;

-- ─────────────────────────────────────────────── 2. corp_history — 연혁 (비수치)
create table corp_history (
  id               bigint generated always as identity primary key,

  corp_code        text not null references companies on delete cascade,
  -- fin_details 와 동일 근거로 cascade — 재추출 가능한 회사 종속 데이터.

  event_ym         text not null,
  -- 파일럿 실측: 원표가 (연도, 내용) 2열뿐이라 월이 없는 경우가 있다 — '2025' 또는
  -- '2025-12' 둘 다 담기는 자유 형식 문자열로 둔다(date/연도 타입으로 강제하면 월이
  -- 없는 원표 다수가 깨진다). 정렬·필터가 필요해지면 화면단에서 파싱한다.

  category         text,
  -- NULL 허용 — 파일럿 실측: 원표에 '구분' 컬럼 자체가 없다. FnGuide 의 '구분'은
  -- 사업보고서에는 없는, FnGuide 가 소제목처럼 붙인 값이었다(계획 문서 지시 그대로).

  content          text not null,

  source_rcept_no  text references filings on delete cascade,
  source_section   text,
  -- fin_details 와 동일 근거의 3단 출처 중 앞 2단. corp_history 는 표 하나(연혁 표)에서만
  -- 나오므로 source_table 은 두지 않는다 — fin_details 처럼 "한 섹션에 표가 여럿"인
  -- 문제가 파일럿에서 나타나지 않았다(연혁은 섹션당 표 하나).

  extracted_by     text not null,
  extracted_at     timestamptz not null default now(),

  unique (corp_code, source_rcept_no, event_ym, content)
  -- 지시받은 대로 직접 판단 + 근거: 연혁 항목은 "고유 키가 없는 자연문 나열"이라
  -- event_ym 만으로는 같은 해에 여러 항목이 있어 구분이 안 되고, category 는 NULL 이
  -- 흔해 유니크 축에 넣을 수 없다. source_rcept_no 를 넣은 이유는 계획 문서가 짚은 대로
  -- "보고서마다 스코프 교체"가 자연스러운 적재 방식이기 때문이다 — 한 회사의 연혁 항목이
  -- 여러 보고서에 반복 등장하는 문제(파일럿에서 실측: 같은 항목이 여러 사업보고서의
  -- "최근 5년" 창에 겹쳐 나온다)를, "그 rcept_no 가 실제로 그 항목을 실었다"는 사실
  -- 자체를 지우지 않고 그대로 남긴다 — source_rcept_no 를 뺀 채 (corp_code, event_ym,
  -- content) 만으로 유니크를 걸면 한 보고서의 재적재(스코프 교체) 때 다른 보고서가 이미
  -- 적재해 둔 동일 문구 행과 충돌해 조용히 손실되거나 갱신 대상이 뒤바뀐다. 대가는 같은
  -- 사실이 여러 rcept_no 로 중복 저장되는 것인데, 이건 "출처가 여럿"이라는 사실 자체를
  -- 보존하는 것이므로 결함이 아니라 설계로 받아들인다.
);

comment on table corp_history is
  '공시 원문(사업보고서 "회사의 연혁" 등)에서 추출한 비수치 연혁 사실. events(주요사항 '
  '보고서)를 대체하지 않는다 — 성격이 다르다(AGENTS.md·계획 문서 SCR-002 결론 유지). '
  'DDL 만 존재하며 데이터는 아직 없다 — 적재는 company-profile-extract 스킬(미착수)의 몫.';

comment on column corp_history.event_ym is
  '''YYYY'' 또는 ''YYYY-MM'' 자유 형식. 파일럿 실측: 원표(사업보고서 "회사의 연혁")가 '
  '연도·내용 2열뿐이라 월 정보가 없는 행이 실재한다 — date 타입으로 강제하지 않는다.';

comment on column corp_history.category is
  'NULL 허용. 파일럿 실측: 원표에 구분 컬럼이 없다 — FnGuide 화면의 ''구분''은 원문에 '
  '없는, FnGuide 가 자체적으로 붙인 소제목이었다.';

alter table corp_history enable row level security;
revoke all on corp_history from anon, authenticated;
grant select, insert, update, delete on corp_history to service_role;
revoke usage, select, update on corp_history_id_seq from anon, authenticated;
grant usage, select on corp_history_id_seq to service_role;

-- public 스키마에 함수를 만들지 않는다 — fin_archive(20260806000002)와 같은 원칙, PostgREST
-- /rpc 표면을 늘리지 않는다. `alter default privileges in schema public revoke all on
-- tables/sequences from anon, authenticated`(20260802000005/000006)가 이미 걸려 있어 이
-- 마이그레이션이 만드는 신규 객체는 애초에 자동 grant 를 받지 않는다 — 위의 명시적 revoke
-- 문들은 "거부는 두 겹" 원칙을 다시 한 번 확인해 두는 것이다.
