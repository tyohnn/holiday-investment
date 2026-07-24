#!/usr/bin/env bash
# Phase 2: 다운로드 없이, 받아둔 영상들의 스크립트(txt+srt) 추출 → 재생목록 순서대로.
#  - 소스: mp3(있으면) 또는 mp4
#  - 안전장치: 스크립트 길이가 오디오 길이 대비 비정상적으로 짧으면(변환 실패) → 재시도, 그래도 짧으면
#              실패 목록에 기록하고 "원본 삭제 안 함"(데이터 보호). 정상일 때만 batchA 원본 삭제.
#  - 재실행 안전. 완전 로컬(whisper.cpp large-v3-turbo).
set -uo pipefail

ROOT="/Users/titanism/projects/주식공부/멤버십"
FAILLOG="/Users/titanism/projects/주식공부/transcribe.failures.txt"
MODEL="$HOME/models/whisper-ggml/ggml-large-v3-turbo-q5_0.bin"
LANG="ko"
MIN_BYTES_PER_SEC=5   # txt 바이트수가 (오디오초 × 5) 미만이면 실패로 간주(정상 강의는 ~50/s)

ORDER=(
  "【멤버십⭐전용】"
  "【멤버십⭐전용】투자 스킬업"
  "【멤버십⭐전용】여니의 주식 상담소"
  "【멤버십⭐전용】여니의 능력범위 향상 프로젝트"
  "【멤버십⭐】스타터 목록"
  "【멤버십⭐특별 강좌 시리즈】"
)

log(){ echo "[$(date '+%m-%d %H:%M:%S')] $*"; }

for pl in "${ORDER[@]}"; do
  dest="$ROOT/$pl"
  if [ ! -d "$dest" ]; then log "!! 폴더 없음, 건너뜀: $pl"; continue; fi
  log "########## 재생목록: $pl ##########"

  for vd in "$dest"/*/; do
    [ -d "$vd" ] || continue
    vfolder="${vd%/}"
    name="$(basename "$vfolder")"
    base="$vfolder/$name"

    src=""
    [ -f "$base.mp3" ] && src="$base.mp3"
    [ -z "$src" ] && [ -f "$base.mp4" ] && src="$base.mp4"

    # 스크립트 없으면 변환(+검증+재시도)
    if [ ! -s "$base.txt" ]; then
      if [ -z "$src" ]; then log "소스 없음(스킵): $name"; continue; fi
      dur=$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$src" 2>/dev/null | cut -d. -f1)
      [[ "$dur" =~ ^[0-9]+$ ]] || dur=0
      minbytes=$((dur * MIN_BYTES_PER_SEC)); [ "$minbytes" -lt 200 ] && minbytes=200

      ok=0
      for attempt in 1 2; do
        log "[stt] $name (시도 $attempt, ${dur}s)"
        wav="$base.16k.wav"
        ffmpeg -y -loglevel error -i "$src" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$wav" </dev/null
        [ -f "$wav" ] || { log "[stt] wav 변환 실패: $name"; break; }
        # -mc 0(max-context 0): 직전 텍스트를 다시 안 물어와서 '반복 환청 루프' 차단
        whisper-cli -m "$MODEL" -f "$wav" -l "$LANG" -otxt -osrt -of "$base" -t 8 -mc 0 -pp </dev/null
        rm -f "$wav"
        c=$(wc -c < "$base.txt" 2>/dev/null | tr -d ' '); [[ "$c" =~ ^[0-9]+$ ]] || c=0
        # 반복 환청 감지: 10바이트 초과 substantive 라인이 40회 이상 반복되면 실패로 간주
        rep=$(awk 'length($0)>10{a[$0]++} END{m=0;for(l in a)if(a[l]>m)m=a[l];print m+0}' "$base.txt" 2>/dev/null)
        [[ "$rep" =~ ^[0-9]+$ ]] || rep=0
        if [ "$c" -ge "$minbytes" ] && [ "$rep" -lt 40 ]; then
          log "[stt] 완료: $name (${c}바이트, 최다반복 ${rep})"; ok=1; break
        fi
        [ "$c" -lt "$minbytes" ] && log "[stt] ⚠️ 너무 짧음 ${c}B < ${minbytes}B — 재시도"
        [ "$rep" -ge 40 ] && log "[stt] ⚠️ 반복 환청 ${rep}회 — 재시도"
        rm -f "$base.txt" "$base.srt"
      done

      if [ "$ok" -ne 1 ]; then
        echo "$base" >> "$FAILLOG"
        log "[stt] ❌ 실패(원본 보존, 실패목록 기록): $name"
        continue   # 원본 삭제하지 않음
      fi
    fi

    # 스크립트 정상 + batchA → 원본(mp4/mp3) 삭제
    if [ -s "$base.txt" ] && [ -f "$vfolder/.batchA" ]; then
      [ -f "$base.mp4" ] && { rm -f "$base.mp4"; log "[del] mp4 삭제: $name"; }
      [ -f "$base.mp3" ] && { rm -f "$base.mp3"; log "[del] mp3 삭제: $name"; }
    fi
  done
  log "########## 완료: $pl ##########"
done

log "=== 전체 트랜스크립션 완료 ==="
[ -f "$FAILLOG" ] && log "⚠️ 실패 항목 있음 → $FAILLOG 확인"
echo "--- 최종 요약 ---"
for d in "$ROOT"/*/; do
  t=$(find "$d" -name '*.txt' -not -name '.download-archive.txt' | wc -l | tr -d ' ')
  v=$(find "$d" -name '*.mp4' | wc -l | tr -d ' ')
  echo "$(basename "$d"): txt=$t (남은 원본mp4=$v)"
done
