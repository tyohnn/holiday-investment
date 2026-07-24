#!/usr/bin/env bash
# Phase 1: 전체 재생목록에서 영상(mp4 720p)+오디오(mp3)를 디스크 여유 8GB 남을 때까지 미리 다운로드.
#  - 영상별 폴더 구조, 받은 영상 폴더에 .batchA 표시(= 드라이브 백업 대상 = 나중에 스크립트 후 삭제 허용)
#  - 트랜스크립션/삭제 없음. 재개 안전(이미 있는 mp4는 건너뜀). 삭제됐던 01~03편도 다시 받음.
set -uo pipefail
shopt -s nullglob

PROFILE="chrome:Profile 1"
ROOT="/Users/titanism/projects/주식공부/강의"
FLOOR_GB=8
FMT="bv*[height<=720][vcodec^=avc1]+ba[acodec^=mp4a]/bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]"

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

STOP=0
for url in "${PLAYLISTS[@]}"; do
  [ $STOP -eq 1 ] && break
  seen_ids=" "   # 재생목록마다 video-id 중복추적 초기화(bash 3.2 호환)
  title=$(yt-dlp --cookies-from-browser "$PROFILE" --flat-playlist --no-warnings \
            --playlist-items 1 --print "%(playlist_title)s" "$url" 2>/dev/null | head -1)
  [ -z "$title" ] && { log "!! 제목 조회 실패, 건너뜀: $url"; continue; }
  safe="${title//\//_}"; dest="$ROOT/$safe"; mkdir -p "$dest"
  log "########## 재생목록: $title ##########"

  while IFS='|' read -r idx id; do
    id="${id//[$'\r\n\t ']/}"     # 공백/CR 제거
    [ -z "$id" ] && continue
    # 같은 video-id 중복 항목 방어(flat-list가 간헐적으로 중복 반환 → 00 중복 생성 원인)
    case "$seen_ids" in *" $id "*) log "중복 id 스킵: $id"; continue;; esac
    seen_ids="$seen_ids$id "
    # 인덱스 이상값(빈값/0/비숫자) 방어 — 10#로 강제 10진수(08,09 8진수 오해 방지)
    if ! [[ "$idx" =~ ^[0-9]+$ ]] || [ "$((10#$idx))" -lt 1 ]; then
      log "!! 인덱스 이상('$idx') → 스킵: $id"; continue
    fi
    fg=$(free_gb)
    if [ "${fg:-0}" -le "$FLOOR_GB" ]; then
      log ">>> 디스크 여유 ${fg}GB ≤ ${FLOOR_GB}GB. 사전 다운로드 중단(여기까지가 배치 A)."
      STOP=1; break
    fi
    NN=$(printf "%02d" "$((10#$idx))")
    [ "$NN" = "00" ] && { log "NN=00 원천 차단: idx='$idx' id=$id"; continue; }

    # 이미 받은 mp4 있나?
    existing=""
    for cand in "$dest/$NN - "*/*.mp4; do [ -f "$cand" ] && { existing="$cand"; break; }; done

    if [ -z "$existing" ]; then
      log "[dl] $NN (여유 ${fg}GB)"
      yt-dlp --cookies-from-browser "$PROFILE" --no-playlist --no-overwrites --no-warnings \
        -f "$FMT" --merge-output-format mp4 \
        -o "$dest/$NN - %(title)s/$NN - %(title)s.%(ext)s" \
        "https://www.youtube.com/watch?v=$id"
      for cand in "$dest/$NN - "*/*.mp4; do [ -f "$cand" ] && { existing="$cand"; break; }; done
    fi

    if [ -n "$existing" ]; then
      base="${existing%.mp4}"
      if [ ! -f "$base.mp3" ]; then
        ffmpeg -y -loglevel error -i "$existing" -vn -c:a libmp3lame -b:a 192k "$base.mp3" </dev/null \
          && log "[mp3] $NN 완료" || log "[mp3] $NN 실패"
      fi
      touch "$(dirname "$existing")/.batchA"   # 배치 A 표시(삭제 허용 대상)
    else
      log "!! $NN 다운로드 실패(스킵)"
    fi
  done < <(yt-dlp --cookies-from-browser "$PROFILE" --flat-playlist --no-warnings \
             --print "%(playlist_index)s|%(id)s" "$url" 2>/dev/null)
done

log "=== 사전 다운로드 종료 (여유 $(free_gb)GB) ==="
echo "--- 배치 A 요약 (드라이브 업로드 대상) ---"
tot_mp4=0; tot_mp3=0
for d in "$ROOT"/*/; do
  m=$(find "$d" -name '*.mp4' | wc -l | tr -d ' ')
  a=$(find "$d" -name '*.mp3' | wc -l | tr -d ' ')
  b=$(find "$d" -name '.batchA' | wc -l | tr -d ' ')
  tot_mp4=$((tot_mp4+m)); tot_mp3=$((tot_mp3+a))
  echo "$(basename "$d"): mp4=$m mp3=$a (batchA표시 $b)"
done
echo "합계: mp4=$tot_mp4 mp3=$tot_mp3 / 디스크 사용 $(du -sh "$ROOT" 2>/dev/null | awk '{print $1}')"
