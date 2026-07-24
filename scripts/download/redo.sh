#!/usr/bin/env bash
# 반복 환청으로 오염된 완성본 재다운로드(txt/srt 삭제 후 mp4 복구). 이후 transcribe.sh(-mc 0)가 재변환.
set -uo pipefail
ROOT="/Users/titanism/projects/주식공부/강의"
PROFILE="chrome:Profile 1"
FMT="bv*[height<=720][vcodec^=avc1]+ba[acodec^=mp4a]/bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]"
log(){ echo "[$(date '+%H:%M:%S')] $*"; }

redo_pl(){
  local pl="$1" url="$2"; shift 2
  local dest="$ROOT/$pl"
  yt-dlp --cookies-from-browser "$PROFILE" --flat-playlist --no-warnings --print "%(playlist_index)s|%(id)s" "$url" > /tmp/fl.txt 2>/dev/null
  local nn vd id
  for nn in "$@"; do
    vd=$(find "$dest" -mindepth 1 -maxdepth 1 -type d -name "$nn - *" | head -1)
    if [ -z "$vd" ]; then log "폴더없음: $pl $nn"; continue; fi
    rm -f "$vd"/*.txt "$vd"/*.srt
    id=$(awk -F'|' -v n="$nn" '($1+0)==(n+0){print $2}' /tmp/fl.txt | head -1)
    if [ -z "$id" ]; then log "id없음: $pl $nn"; continue; fi
    log "재다운로드 $pl / $nn ($id)"
    yt-dlp --cookies-from-browser "$PROFILE" --no-playlist --no-overwrites --no-warnings \
      -f "$FMT" --merge-output-format mp4 \
      -o "$dest/$nn - %(title)s/$nn - %(title)s.%(ext)s" \
      "https://www.youtube.com/watch?v=$id" 2>&1 | grep -E 'Merging|ERROR' | tail -1
    touch "$vd/.batchA"
  done
}

log "=== 오염본 재다운로드 시작 ==="
redo_pl "【강의 멤버십⭐전용】"            "https://www.youtube.com/playlist?list=PLF67QBTodqAUcDMMSIFzuRvBIp6jMCpDe" 03 04 13 19
redo_pl "【강의 멤버십⭐전용】투자 스킬업" "https://www.youtube.com/playlist?list=PLF67QBTodqAUjLK936XdzUB01Ih6ijWwm" 07 08 10 11 14
log "=== 재다운로드 완료 ==="
echo "복구된 mp4:"; for pl in "【강의 멤버십⭐전용】" "【강의 멤버십⭐전용】투자 스킬업"; do
  for nn in 03 04 13 19 07 08 10 11 14; do
    find "$ROOT/$pl" -mindepth 1 -maxdepth 1 -type d -name "$nn - *" -exec sh -c 'ls "$1"/*.mp4 >/dev/null 2>&1 && echo "  OK: $(basename "$1")"' _ {} \; 2>/dev/null
  done
done | sort -u
