#!/usr/bin/env bash
# 강의 멤버십 9개 재생목록 → 재생목록 폴더 아래 "영상별 폴더" 구조로 처리.
#   <재생목록>/<NN - 제목>/<NN - 제목>.{mp4,mp3,txt,srt}
# 순차 처리 · 재개(idempotent) · 디스크 보호 · 완전 로컬(whisper.cpp)
set -uo pipefail

PROFILE="chrome:Profile 1"
ROOT="/Users/titanism/projects/주식공부/강의"
MODEL="$HOME/models/whisper-ggml/ggml-large-v3-turbo-q5_0.bin"
LANG="ko"
FLOOR_GB=8

PLAYLISTS=(
  "https://www.youtube.com/playlist?list=PLF67QBTodqAUcDMMSIFzuRvBIp6jMCpDe"   # 1 멤버십 전용 (21)
  "https://www.youtube.com/playlist?list=PLF67QBTodqAUjLK936XdzUB01Ih6ijWwm"   # 2 투자 스킬업 (48)
  "https://www.youtube.com/playlist?list=PLF67QBTodqAX8C-tjj2EjUJwdGPYYFXTT"   # 3 주식 상담소 (39)
  "https://www.youtube.com/playlist?list=PLF67QBTodqAXFHTtbH1zlwGEH7OvGBkCn"   # 4 능력범위 향상 (38)
  "https://www.youtube.com/playlist?list=PLF67QBTodqAU3n8Zj90ufPfEhppvvo78J"   # 5 스타터 목록 (8)
  "https://www.youtube.com/playlist?list=PLF67QBTodqAU70w2WcXyUGXn-oo2SVKHd"   # 6 특별 강좌 시리즈 (1)
  "https://www.youtube.com/playlist?list=PLF67QBTodqAUs7Xq_qLRuBYwj7SuyTi-M"   # 7 주식은 멘탈이다 (3)
  "https://www.youtube.com/playlist?list=PLfK7v9fAl_B4"                         # 8 돈이 보이는 주식의 역사 (4)
  "https://www.youtube.com/playlist?list=PLF67QBTodqAVbMmZapquO4SKhn4kbCXtO"   # 9 세계사를 바꾼 커피 (6)
)

log(){ echo "[$(date '+%m-%d %H:%M:%S')] $*"; }
free_gb(){ df -g "$ROOT" | tail -1 | awk '{print $4}'; }

# 재생목록 폴더 안 "평평한" 파일을 영상별 폴더로 정규화(과거 산출물 대비, 반복 안전)
migrate_flat(){
  local dest="$1" f b stem
  shopt -s nullglob
  rm -f "$dest"/*.16k.wav
  for f in "$dest"/*.mp4 "$dest"/*.mp3 "$dest"/*.txt "$dest"/*.srt; do
    b="$(basename "$f")"; stem="${b%.*}"
    mkdir -p "$dest/$stem"
    mv -n "$f" "$dest/$stem/"
  done
}

process_playlist(){
  local url="$1" title dest safe fg f base name wav
  title=$(yt-dlp --cookies-from-browser "$PROFILE" --flat-playlist --no-warnings \
            --playlist-items 1 --print "%(playlist_title)s" "$url" 2>/dev/null | head -1)
  [ -z "$title" ] && { log "!! 제목 조회 실패, 건너뜀: $url"; return; }
  safe="${title//\//_}"; dest="$ROOT/$safe"; mkdir -p "$dest"
  log "########## 재생목록: $title ##########"
  migrate_flat "$dest"

  fg=$(free_gb)
  if [ "${fg:-0}" -lt "$FLOOR_GB" ]; then
    log "!! 디스크 여유 ${fg}GB < ${FLOOR_GB}GB. 다운로드 생략, 기존 파일만 처리."
  else
    log "[다운로드] 720p mp4 · 영상별 폴더 (여유 ${fg}GB)"
    yt-dlp \
      --cookies-from-browser "$PROFILE" \
      -f "bv*[height<=720][vcodec^=avc1]+ba[acodec^=mp4a]/bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]" \
      --merge-output-format mp4 \
      --download-archive "$dest/.download-archive.txt" \
      --ignore-errors --no-warnings --newline \
      -o "$dest/%(playlist_index)02d - %(title)s/%(playlist_index)02d - %(title)s.%(ext)s" \
      "$url"
  fi

  # 영상별 폴더 순회 → mp3 + 스크립트
  shopt -s nullglob
  for f in "$dest"/*/*.mp4; do
    base="${f%.mp4}"; name="$(basename "$base")"
    if [ ! -f "$base.mp3" ]; then
      log "[mp3] $name"
      ffmpeg -y -loglevel error -i "$f" -vn -c:a libmp3lame -b:a 192k "$base.mp3" </dev/null \
        && log "[mp3] 완료" || log "[mp3] 실패: $name"
    fi
    if [ ! -f "$base.txt" ]; then
      log "[stt] $name (변환중...)"
      wav="$base.16k.wav"
      ffmpeg -y -loglevel error -i "$f" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$wav" </dev/null
      if [ -f "$wav" ]; then
        whisper-cli -m "$MODEL" -f "$wav" -l "$LANG" -otxt -osrt -of "$base" -t 8 -pp </dev/null \
          && log "[stt] 완료: $name" || log "[stt] 실패: $name"
        rm -f "$wav"
      else
        log "[stt] wav 변환 실패: $name"
      fi
    fi
    # 스크립트 완성(txt 비어있지 않음) → 영상/오디오 삭제, txt+srt만 남김
    if [ -s "$base.txt" ]; then
      [ -f "$f" ]        && { rm -f "$f";        log "[cleanup] mp4 삭제: $name"; }
      [ -f "$base.mp3" ] && { rm -f "$base.mp3"; log "[cleanup] mp3 삭제: $name"; }
    fi
  done
  log "########## 완료: $title ##########"
}

# 시작 시: 이미 스크립트가 있는 영상의 mp4/mp3 정리(소급 적용)
initial_cleanup(){
  shopt -s nullglob
  local f base
  for f in "$ROOT"/*/*/*.mp4; do
    base="${f%.mp4}"
    if [ -s "$base.txt" ]; then
      rm -f "$f" "$base.mp3"
      log "[cleanup] 기존 완료본 정리: $(basename "$base")"
    fi
  done
}

log "=== run-all 시작 (9개 재생목록, 영상별 폴더 구조, 스크립트 후 영상/오디오 자동삭제) ==="
initial_cleanup
for pl in "${PLAYLISTS[@]}"; do
  process_playlist "$pl"
done

log "=== 전체 완료 ==="
echo "--- 최종 요약 ---"
for d in "$ROOT"/*/; do
  m=$(find "$d" -name '*.mp4' | wc -l | tr -d ' ')
  a=$(find "$d" -name '*.mp3' | wc -l | tr -d ' ')
  t=$(find "$d" -name '*.txt' -not -name '.download-archive.txt' | wc -l | tr -d ' ')
  echo "$(basename "$d"): 영상폴더기준 mp4=$m mp3=$a txt=$t"
done
