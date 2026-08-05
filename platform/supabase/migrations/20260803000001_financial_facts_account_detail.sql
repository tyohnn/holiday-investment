-- financial_facts 중복 행 사고 — 원인 컬럼 복원 + 재발 차단.
--
-- ─────────────────────────────────────────────── 무슨 일이 있었나
--
-- 호스티드에 915개사 6,215,443행을 적재한 뒤 세어보니 "id 를 뺀 전 컬럼이 완전히
-- 같은" 행이 66만 건 넘게 있었다. 처음 의심한 것은 적재 파이프라인이었다 —
-- (1) 백필 프로세스 2개가 동시에 돌아 delete→delete→insert→insert 로 엇물렸거나,
-- (2) replace_scope 의 DELETE 가 스코프를 다 지우지 못해 옛 행이 남았거나.
-- 둘 다 아니었다. 실측으로 기각했다:
--
--   * data/raw 에 저장해 둔 DART 원본 응답과 DB 를 915개사 전부 대조했더니
--     DB 행 수 == 원본 행 수 가 914/915 에서 정확히 일치했다(나머지 1개사는
--     오히려 159행 부족 — 디스크 풀 크래시 흔적이지 중복이 아니다).
--     어느 회사도 2배가 아니었다 → (1) 기각. 남은 행도 없었다 → (2) 기각.
--   * 중복은 40개사에 몰려 있지 않았다. 810/812 개사에 고르게 퍼져 있었다.
--
-- 진짜 원인은 세 번째였다. 그리고 이건 "중복"이 아니라 컬럼 유실이었다.
--
-- DART finstate_all 응답에는 account_detail 이라는 컬럼이 있는데 ingest 가 이걸
-- 통째로 버리고 있었다. 자본변동표(sj_div='SCE')는 2차원 표다 — 세로축이 계정,
-- 가로축이 자본 구성요소(자본금 / 자본잉여금 / 이익잉여금 / 기타포괄손익누계액 /
-- 비지배지분 / 합계 …)이고, 그 가로축을 담는 유일한 필드가 account_detail 이다.
-- 예: 한 계정 'dart_PurchaseDispostionOfAssociatesOrJointVenture' 가 8행으로 오고
-- 여덟 행의 차이는 account_detail 뿐이다:
--     자본 [member]|지배기업의 소유주에게 귀속되는 자본 [member]|자본금 [member]
--     자본 [member]|지배기업의 소유주에게 귀속되는 자본 [member]|이익잉여금 [member]
--     자본 [member]|비지배지분 [member]  …
-- 이걸 버리면 서로 다른 8개 셀이 완전히 똑같은 8행이 된다.
--
-- 검증: 원본 응답에서 자연키에 account_detail 을 넣으면 중복이 정확히 0이 된다
-- (raw 344,136행 → 잉여 0). 빼면 10.49% 가 중복으로 보인다. DB 쪽도 같은 그림이라
-- 2023년 슬라이스의 잉여 행을 sj_div 별로 갈라보니 SCE 63,356 / BS 0 / CIS 0 /
-- CF 0 / IS 0 — 전량 SCE 였다. 원인은 하나뿐이다.
--
-- ─────────────────────────────────────────────── 이 마이그레이션이 하는 일
--
-- 1) account_detail 컬럼을 추가한다(ingest.py 가 이제 채운다).
-- 2) 완전 중복 행을 연도 단위로 접는다 — 아래 유니크 인덱스는 중복이 남아 있으면
--    생성 자체가 실패하므로 반드시 먼저 와야 한다. 호스티드에서는 이 마이그레이션을
--    적용하기 전에 같은 로직을 이미 한 번 돌려 667,039행을 제거했고, 그래서 여기서는
--    no-op 이다. 다른 환경(로컬 스택·신규 복제본)에서도 스스로 성립하도록 남겨둔다.
--    연도로 쪼개는 이유는 단순히 6.2M 행을 한 문장에서 정렬하지 않기 위해서다.
-- 3) 자연키 유니크 인덱스를 건다.
--
-- ─────────────────────────────────────────────── 왜 삭제 필터에 fs_div 를 안 넣나
--
-- 의심 대상 중 하나가 "replace_scope 의 필터는 (corp, year, reprt) 인데 삽입되는 행은
-- fs_div 를 달고 있다 — 범위 불일치 아니냐" 였다. 아니다. 오히려 fs_div 를 필터에
-- 넣으면 안 된다. finstate_all 은 CFS(연결)를 먼저 시도하고 없으면 OFS(별도)로
-- 폴백하므로 같은 (corp, year, reprt) 의 fs_div 가 연도별로도, 재적재 시점별로도
-- 바뀐다. 필터에 fs_div 를 넣으면 이전 적재가 남긴 반대쪽 fs_div 행이 지워지지 않고
-- 살아남아 한 스코프에 연결·별도가 뒤섞인다 — 지금 사고보다 나쁜 오염이다.
-- 스코프 삭제는 지금처럼 넓게 지우는 것이 옳다. 이 부분은 고치지 않는다.

alter table financial_facts add column if not exists account_detail text;

comment on column financial_facts.account_detail is
  '자본변동표(SCE)의 자본 구성요소 축 — 이 컬럼이 없으면 SCE 행이 서로 구분되지 않는다. '
  'BS·CF 등 1차원 재무제표에서는 대개 ''-'' 로 온다.';

-- 완전 중복 접기 — 그룹당 최소 id 만 남긴다. 호스티드에서는 선행 실행으로 이미 0건이다.
do $$
declare
  y int;
  n bigint;
  total bigint := 0;
begin
  for y in select distinct bsns_year from financial_facts order by 1 loop
    with dup as (
      select id from (
        select id, row_number() over (
          partition by corp_code, reprt_code, fs_div, sj_div, account_id, account_nm,
                       account_detail, ord, amount, amount_prev, amount_prev2,
                       currency, rcept_no
          order by id) rn
        from financial_facts where bsns_year = y) t
      where rn > 1)
    delete from financial_facts f using dup where f.id = dup.id;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  raise notice 'financial_facts 완전 중복 제거: %행', total;
end $$;

-- 자연키 = id 를 뺀 전 컬럼.
--
-- ★ nulls not distinct 가 핵심이다(PG15+, 호스티드는 17.6 실측). account_id·ord·
--   amount·rcept_no·account_detail 은 전부 nullable 인데, 기본값인 nulls distinct 로
--   두면 NULL 이 낀 행끼리는 영원히 충돌하지 않아 인덱스가 가드 역할을 전혀 못 한다.
--   지금 사고의 행들이 정확히 그 모양이다(예: 분기보고서는 frmtrm_amount 가 없어
--   amount_prev 가 NULL 이다). 반대로 nulls not distinct 는 NULL 을 값처럼 비교해
--   "완전히 똑같은 행"의 정의와 일치한다.
--
-- ★ 더 좁고 의미상 더 옳은 키가 있다:
--     (corp_code, bsns_year, reprt_code, fs_div, sj_div, account_id, account_nm,
--      account_detail, ord, rcept_no)
--   금액은 키가 아니라 값이기 때문이다 — 한 보고서(rcept_no)가 한 계정·한 자본항목에
--   대해 보고하는 금액은 하나뿐이다. 원본 51만 행에서 위반 0건으로 실측도 됐다.
--   그런데 지금은 못 쓴다: 이미 적재된 915개사의 행은 account_detail 이 전부 NULL 이라
--   (그게 이 사고다) 좁은 키로는 SCE 행들이 서로 충돌해 인덱스가 생성되지 않는다.
--   915개사를 account_detail 포함으로 재적재한 뒤 좁은 키로 강화하는 것이 후속 과제다.
create unique index if not exists ff_natural_key
  on financial_facts (corp_code, bsns_year, reprt_code, fs_div, sj_div,
                      account_id, account_nm, account_detail, ord,
                      amount, amount_prev, amount_prev2, currency, rcept_no)
  nulls not distinct;

-- 권한 주의(20260802000005 / 20260802000006 의 그 발판): 여기서는 신규 테이블도
-- 시퀀스도 만들지 않는다 — 기존 테이블의 컬럼과 인덱스뿐이다. 인덱스는 grant 대상
-- 객체가 아니고, financial_facts 의 권한은 20260802000005 가 회수한 상태 그대로
-- 유지된다(anon·authenticated 0, service_role 만). 새로 열리는 표면은 없다.
