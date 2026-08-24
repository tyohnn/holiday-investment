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

start_partitions() {
  for i in 0 1 2 3; do
    DART_API_KEYS="$(cat platform/data/p3_keys$i.txt)" DART_MIN_INTERVAL=1.7 \
      nohup caffeinate -is python3 -u platform/ingest/backfill.py run --phase 3 \
      --companies "$(cat platform/data/p3_part$i.txt)" --budget 100000 \
      > platform/backfill-phase3-p$i.log 2>&1 &
    sleep 2
  done
  say "파티션 4개 기동 (간격 1.7s/프로세스 ≈ 전체 2.3콜/초)"
}

stop_partitions() {
  kill -TERM $(pgrep -f "python3 -u platform/ingest/backfill.py run --phase 3") 2>/dev/null
  for _ in $(seq 1 40); do
    pgrep -f "python3 -u platform/ingest/backfill.py run --phase 3" >/dev/null || break
    sleep 3
  done
  say "파티션 정지 (체크포인트 보존)"
}

say "=== phase3_daily 시작 ==="
while true; do
  wait_unblocked
  start_partitions

  # 그날 몫을 다 쓸 때까지 감시
  while true; do
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
