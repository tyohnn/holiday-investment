-- A2 판정 결과 반영: 사실 원장(trackings)을 정본으로 채택하고, 실험에서 드러난
-- 결함 3가지를 고친다. (로드맵 "P-A 설계 유보 사항 ⑵" 종결)

-- 결함 1: 날짜 정밀도. md 실험에서 에이전트가 '2025-09'(월만 아는 사실)를 자연스럽게
--   썼고, md 파서는 조용히 누락시켰다. date 타입은 이를 아예 거부한다 — 둘 다 틀렸다.
--   사실의 시점 정밀도는 데이터의 성질이므로 컬럼으로 표현한다.
alter table trackings add column date_precision text not null default 'day'
  check (date_precision in ('day', 'month', 'quarter', 'year'));

-- 결함 2: 교차 배치. IPO 증권신고서의 '자금사용목적: 타법인증권취득'은 자금조달이면서
--   M&A다. md 실험에서 에이전트가 "어느 문서에 넣을지 임의 판단했고 확신 못 한다"고
--   보고했다 — 주제는 단일 분류가 아니라 primary + 태그여야 한다.
alter table trackings add column tags text[] not null default '{}';
create index tr_tags on trackings using gin (tags);

-- 결함 3: 중복 키. (topic, date, fact앞60자) 키는 같은 공시를 두 에이전트가 다른
--   날짜 기준(접수일 vs 합병기일)·다른 문장으로 쓰면 중복을 놓친다. 실제로 놓쳤다.
--   출처 공시가 있는 사실은 (topic, rcept_no)가 훨씬 강한 신호다.
create index tr_rcept on trackings (corp_code, topic, rcept_no) where rcept_no is not null;

comment on column trackings.fact_date is
  '사실의 시점. 공시발이면 접수일(rcept_dt)을 기준으로 한다 — 이사회결의일·효력발생일이
   아니라. 그 날짜들은 fact 본문이나 value_text에 적는다. (A2 실험에서 기준 미문서화로
   두 에이전트가 다른 날짜를 쓴 사례 발생)';
comment on column trackings.tags is
  '주제 교차 배치용. 예: topic=자금조달-지분희석, tags={투자집행-MA}';
comment on table trackings is
  'append-only 사실 원장. UPDATE/DELETE 금지 — 정정도 새 행으로 추가한다.';

-- 실험 중 발생한 중복 정리: 같은 (corp, topic, rcept_no)에서 나중에 들어온 행 제거.
-- (A안 md → import 분이 B안 CLI 입력분과 겹친 것)
delete from trackings t
using trackings k
where t.rcept_no is not null
  and t.corp_code = k.corp_code and t.topic = k.topic and t.rcept_no = k.rcept_no
  and t.id > k.id;
