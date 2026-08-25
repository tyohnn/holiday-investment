#!/bin/bash
# Phase 3 야간 무인 운영 — 차단 해제 대기 → 조율된 속도로 재개 → 매일 반복.
#
# 왜 이런 게 필요한가 (2026-08-23 실측):
#   10키로 6시간에 256,248콜을 쓰자 21시부터 020(일일 쿼터)이 쏟아졌고, 소진된 키에
#   재시도가 몰리며 IP 차단까지 갔다. "키당 2만/일"이 실제로 집행된다 — 속도가 아니라
#   **하루 총량**이 벽이다. 총량이 정해져 있으면 빨리 쓰고 막히느니 24시간에 펴는 게 낫다.
#
# 전략:
#   - DART_MIN_INTERVAL=1.7 (프로세스당) × 4프로세스 ≈ 전체 2.3콜/초 ≈ 20만콜/24시간
#   - 020 이 일정 수 이상 나오면 그날 몫을 다 쓴 것 → 즉시 정지하고 다음날 00:10 까지 대기
#     (재시도 폭주가 IP 페널티로 번지는 것을 막는 것이 이 스크립트의 핵심 목적)
#   - IP 차단 상태면 API 키 없는 가벼운 요청으로 5분마다 확인만 하며 대기
set -u
cd "$(dirname "$0")/../.." || exit 1
LOG=platform/phase3-daily.log
say() { echo "[$(date '+%m-%d %H:%M')] $*" >> "$LOG"; }

url() { grep -E '^NEXT_PUBLIC_SUPABASE_URL' apps/web/.env.local | cut -d= -f2- | tr -d '"'"'"' '; }
key() { grep -E '^SUPABASE_SERVICE_KEY' apps/web/.env.local | cut -d= -f2- | tr -d '"'"'"' '; }

count_020() {  # 최근 10분간 020 실패 수
  curl -s -I -G "$(url)/rest/v1/filing_docs" \
    --data-urlencode "status=like.*020*" \
    --data-urlencode "fetched_at=gte.$(python3 -c "import datetime as d;print((d.datetime.now(d.timezone.utc)-d.timedelta(minutes=10)).isoformat())")" \
    --data-urlencode "select=rcept_no" -H "apikey: $(key)" -H "Authorization: Bearer $(key)" \
    -H "Prefer: count=exact" -H "Range-Unit: items" -H "Range: 0-0" 2>/dev/null \
    | grep -i content-range | sed 's/.*\///' | tr -d '\r'
}

wait_unblocked() {
  while true; do
    c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 https://opendart.fss.or.kr/ 2>/dev/null)
    [ "$c" = "200" ] && { say "IP 차단 해제 확인"; return 0; }
    sleep 300
  done
}

# 오늘 이미 쓴 콜 수 (전 키 합계). KeyPool 이 원장에 upsert 하므로 여기서 되읽는다.
used_today() {
  curl -s -G "$(url)/rest/v1/ingest_api_quota" \
    --data-urlencode "quota_date=eq.$(date '+%Y-%m-%d')" \
    --data-urlencode "select=calls_used" -H "apikey: $(key)" -H "Authorization: Bearer $(key)" 2>/dev/null \
    | python3 -c "import sys,json;print(sum(r['calls_used'] for r in json.load(sys.stdin)))" 2>/dev/null || echo 0
}

start_partitions() {
  # 이미 돌고 있으면 다시 띄우지 않는다 — 러너를 재기동해도 파티션이 중복 생성되지
  # 않게 하는 멱등 가드(중복되면 같은 회사를 두 프로세스가 잡고 쿼터를 두 배로 태운다).
  n=$(pgrep -f "python3 -u platform/ingest/backfill.py run --phase 3" | wc -l | tr -d ' ')
  if [ "$n" -gt 0 ]; then say "파티션 ${n}개 이미 실행 중 — 기동 생략"; return 0; fi
  # ★ --budget 은 키당 실제 일일 한도(20,000)여야 한다. 이전엔 100000 이라 KeyPool 이
  #   소진을 영영 감지하지 못했고, 한도를 넘긴 뒤에도 계속 때려 020 폭주 → IP 차단으로
  #   갔다(2026-08-23·24 두 번). 2만으로 두면 KeyPool 이 스스로 키를 소진 처리하고
  #   전 키 소진 시 정상 종료한다 — 020 을 애초에 만들지 않는 것이 최선의 방어다.
  for i in 0 1 2 3; do
    DART_API_KEYS="$(cat platform/data/p3_keys$i.txt)" DART_MIN_INTERVAL=1.7 \
      nohup caffeinate -is python3 -u platform/ingest/backfill.py run --phase 3 \
      --companies "$(cat platform/data/p3_part$i.txt)" --budget 20000 \
      > platform/backfill-phase3-p$i.log 2>&1 &
    sleep 2
  done
  say "파티션 4개 기동 (간격 1.7s/프로세스, 키당 예산 2만)"
}

stop_partitions() {
  # kill -TERM $(pgrep -f ...) 는 pgrep 이 PID 여러 줄을 돌려주면(파티션 4개 기동 시 항상
  # 이 경우다) 이 쉘 환경에서 통짜 인자 하나로 뭉개져 "illegal pid" 로 실패한다(뒤의
  # 2>/dev/null 이 조용히 삼켰다) — 2026-08-25 실측: 08-24~08-25 사이 재기동될 때마다
  # 이전 파티션이 하나도 안 죽고 쌓여 최종 16개가 며칠씩 살아남아 Phase A(섹션분할) 워커와
  # DB 를 동시에 두들겨 statement timeout 을 유발했다. xargs 는 같은 쉘에서 각 줄을
  # 별도 인자로 정상 분리했다 — 그것으로 교체한다.
  pgrep -f "python3 -u platform/ingest/backfill.py run --phase 3" | xargs -r -n1 kill -TERM
  for _ in $(seq 1 40); do
    pgrep -f "python3 -u platform/ingest/backfill.py run --phase 3" >/dev/null || break
    sleep 3
  done
  # 40회(120초) 대기해도 안 죽는 프로세스는 SIGTERM 을 무시하고 있다는 뜻 — 체크포인트가
  # ingest_progress 에 이미 있어 강제 종료해도 reclaim_stale_running() 이 복구한다.
  pgrep -f "python3 -u platform/ingest/backfill.py run --phase 3" | xargs -r -n1 kill -9
  say "파티션 정지 (체크포인트 보존)"
}

say "=== phase3_daily 시작 ==="
while true; do
  wait_unblocked

  # ★ 시작 전 오늘 몫 확인. 2026-08-24 사고: 어제 태운 물량이 KST 기준 오늘 날짜로
  #   기록돼 있었는데(09시엔 이미 31만콜 소진) 그걸 안 보고 재개해 10분 만에 020 1,424건
  #   → IP 차단. "차단이 풀렸다"와 "오늘 쓸 몫이 남았다"는 다른 조건이다.
  u=$(used_today)
  started=0
  if [ -n "$u" ] && [ "$u" -ge 180000 ]; then
    say "오늘 이미 ${u}콜 사용 — 한도(20만) 근접, 기동 생략하고 다음날 대기"
  else
    say "오늘 사용 ${u}콜 — 기동"
    start_partitions
    started=1
  fi

  # 그날 몫을 다 쓸 때까지 감시 (기동 안 했으면 건너뛴다)
  while [ "$started" -eq 1 ]; do
    sleep 600
    alive=$(pgrep -f "python3 -u platform/ingest/backfill.py run --phase 3" | wc -l | tr -d ' ')
    if [ "$alive" -eq 0 ]; then say "파티션 전부 종료됨(완주 또는 크래시)"; break; fi
    q=$(count_020)
    if [ -n "$q" ] && [ "$q" -gt 300 ]; then
      say "020 급증(최근10분 ${q}건) — 오늘 쿼터 소진으로 판단, 정지"
      stop_partitions
      break
    fi
  done

  # 남은 작업이 있는지 확인 후, 다음날 쿼터 리셋까지 대기
  left=$(curl -s -I -G "$(url)/rest/v1/ingest_progress" \
    --data-urlencode "stage=eq.docs" --data-urlencode "status=in.(pending,running)" \
    --data-urlencode "select=corp_code" -H "apikey: $(key)" -H "Authorization: Bearer $(key)" \
    -H "Prefer: count=exact" -H "Range-Unit: items" -H "Range: 0-0" 2>/dev/null \
    | grep -i content-range | sed 's/.*\///' | tr -d '\r')
  if [ -n "$left" ] && [ "$left" = "0" ]; then say "★ Phase 3 완주 — 남은 회사 0"; break; fi
  say "남은 회사 ${left} — 다음날 00:10 까지 대기"
  target=$(python3 -c "
import datetime as d
n=d.datetime.now(); t=(n+d.timedelta(days=1)).replace(hour=0,minute=10,second=0,microsecond=0)
print(int((t-n).total_seconds()))")
  sleep "$target"
done
say "=== phase3_daily 종료 ==="
