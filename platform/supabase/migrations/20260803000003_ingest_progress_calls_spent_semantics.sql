-- ingest_progress.calls_spent 의미론 확정 + 스키마 코멘트 정정.
--
-- 배경: 20260802000002 가 이 컬럼을 만들면서 "이 단계가 지금까지 실측 소비한 호출수"(누적)
-- 라고 인라인 주석을 달았지만, mark_done/mark_failed/mark_pending 어디서도 실제로 쓴 적이
-- 없어 모든 완료 행이 calls_spent=0 이었다(관측된 갭). platform/ingest/backfill.py 가 이제
-- 이 값을 채우면서, 주석이 말하던 "누적"이 아니라 "직전 시도"(last attempt) 의미론을 택했다
-- — 스키마 코멘트가 계속 반대로 말하고 있으면 나중에 헷갈리므로 여기서 바로잡는다.
--
-- 왜 누적이 아니라 직전 시도인가(둘 다 검토했다):
--   - 이 값의 존재 이유는 "이 단계가 회사 1곳당 몇 콜을 쓰는가"의 분포(min/median/max)를
--     재는 것이다(집계 평균은 ingest_api_quota.calls_used 차분으로 이미 구할 수 있음 —
--     이 컬럼이 없어도 되는 부분). 누적을 쓰면 재시도된 회사가 실제보다 부풀려져서 정확히
--     "가장 알고 싶은 사례"(재시도가 잦았던 단계·회사)의 분포를 왜곡한다.
--   - 누적을 구현하려면 `calls_spent = calls_spent + N` 이 필요한데 PostgREST PATCH 는 이
--     식을 표현 못 한다 — read-then-write(라운드트립 추가, 지금은 단일 라이터라 안전하지만
--     동시 실행이 생기면 레이스) 또는 DB 함수가 필요하다. public 스키마에 함수를 추가하면
--     PUBLIC 기본 EXECUTE grant 가 붙는 RPC 노출면이 새로 생기는데(20260802000005/000006 의
--     `alter default privileges` 는 테이블·시퀀스만 다루고 함수는 다루지 않는다), 이건 그
--     두 마이그레이션이 의도적으로 피한 구멍이다.
--   - 직전 시도는 스냅샷 한 번(잡 시작 전 pool.used 총합) · 델타 한 번(잡 종료 후 재계산)으로
--     끝나고, 그 값을 얹은 평범한 PATCH 한 번이면 된다 — 추가 라운드트립도, 새 RPC 노출면도
--     없다.
--
-- 결과: calls_spent 는 "이 (회사,단계) 가 가장 최근에 시도됐을 때 실제로 쓴 호출수"다.
-- done 이면 성공한 그 시도의 비용, failed/pending(중단·쿼터소진 등으로 재대기열 복귀)이면
-- 그 미완 시도가 쓴 비용 — 두 경우 다 "그 시도"만 반영하고 이전 시도 이력과 합산하지 않는다.
-- skipped 는 게이트가 API 콜을 전혀 쓰지 않고 판단하므로 여전히 0 그대로(그대로 둠, 로직
-- 변경 없음).

comment on column ingest_progress.calls_spent is
  '가장 최근 시도가 실측 소비한 호출수(직전 시도 기준, 누적 아님 — 재시도로 부풀려지지 않게 '
  '해서 회사별 단계 비용 분포(min/median/max) 측정에 그대로 쓸 수 있게 한다. 예산 계획용 '
  '집계 평균이 필요하면 ingest_api_quota.calls_used 를 날짜별로 차분해서 구한다). '
  'mark_done/mark_failed/mark_pending(델타를 아는 경로) 이 채우고, mark_skipped 는 게이트가 '
  'API 콜을 쓰지 않으므로 항상 0 그대로 둔다. platform/ingest/backfill.py cmd_run 참고.';
