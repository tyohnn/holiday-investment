#!/usr/bin/env python3
"""유튜브 수집기 — yt-dlp 로 영상을 검색하고 자막을 타임스탬프 md 로 저장한다 (심층 모드용).

이 스크립트만 외부 CLI(yt-dlp)에 의존한다. 없으면 안내 후 exit 2 — 스킬은 이 단계를
건너뛰고 계속 진행한다 (우아한 강등). 설치: `brew install yt-dlp` 또는 `pipx install yt-dlp`.

사용법:
    # 1) 검색 — 후보 목록(JSON). 에이전트가 신뢰할 채널(공식 IR·증권사·전문 채널)만 고른다
    python3 fetch_youtube.py search "크래프톤 IR 실적" --limit 10

    # 2) 자막 추출 — 선별한 URL을 타임스탬프 md 로 저장
    python3 fetch_youtube.py subs <URL> --out-dir 자료/유튜브/

자동 자막 기반이라 전사 품질은 영상마다 다르다. 자막이 아예 없으면 메타데이터만 기록된다.
발췌 인용 시 타임스탬프([mm:ss])를 함께 적는 규칙은 data-layout.md 참조.
"""
import argparse
import datetime as dt
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile


def require_ytdlp():
    if shutil.which("yt-dlp"):
        return
    print(json.dumps({
        "ok": False, "skip": True,
        "reason": "yt-dlp 미설치 — 이 단계를 건너뛰고 분석을 계속하라",
        "설치": "brew install yt-dlp  (또는 pipx install yt-dlp)",
    }, ensure_ascii=False))
    sys.exit(2)


def run(cmd, timeout=180):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def cmd_search(query, limit):
    r = run(["yt-dlp", "ytsearch%d:%s" % (limit, query),
             "--dump-json", "--flat-playlist", "--no-warnings"])
    videos = []
    for line in r.stdout.splitlines():
        try:
            v = json.loads(line)
        except json.JSONDecodeError:
            continue
        dur = v.get("duration")
        videos.append({
            "제목": v.get("title"),
            "채널": v.get("channel") or v.get("uploader"),
            "URL": v.get("url") or "https://www.youtube.com/watch?v=%s" % v.get("id"),
            "길이_분": round(dur / 60, 1) if dur else None,
            "조회수": v.get("view_count"),
        })
    print(json.dumps({"ok": True, "쿼리": query, "결과": videos}, ensure_ascii=False, indent=2))
    if not videos:
        sys.exit(1)


VTT_TS = re.compile(r"^(\d{2}):(\d{2}):(\d{2})\.\d{3}\s+-->")
TAG = re.compile(r"<[^>]+>")


def vtt_to_blocks(path, block_sec=30):
    """VTT → (타임스탬프, 텍스트) 블록. 자동 자막의 롤링 중복 줄을 제거한다."""
    blocks, cur_ts, cur_lines, last_line = [], None, [], None
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            m = VTT_TS.match(line)
            if m:
                sec = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
                if cur_ts is None or sec - cur_ts >= block_sec:
                    if cur_lines:
                        blocks.append((cur_ts, " ".join(cur_lines)))
                    cur_ts, cur_lines = sec, []
                continue
            if not line or line == "WEBVTT" or line.startswith(("Kind:", "Language:", "NOTE")):
                continue
            text = TAG.sub("", line).strip()
            if text and text != last_line:
                cur_lines.append(text)
                last_line = text
    if cur_lines:
        blocks.append((cur_ts or 0, " ".join(cur_lines)))
    return blocks


def fmt_ts(sec):
    return "[%02d:%02d]" % (sec // 60, sec % 60) if sec < 3600 \
        else "[%d:%02d:%02d]" % (sec // 3600, (sec % 3600) // 60, sec % 60)


def cmd_subs(url, out_dir):
    meta_r = run(["yt-dlp", "--dump-json", "--no-warnings", "--skip-download", url])
    try:
        meta = json.loads(meta_r.stdout.splitlines()[0])
    except (IndexError, json.JSONDecodeError):
        print(json.dumps({"ok": False, "error": "영상 메타데이터 조회 실패: %s" % meta_r.stderr[-300:]},
                         ensure_ascii=False))
        sys.exit(1)

    title = meta.get("title", "제목미상")
    upload = meta.get("upload_date", "")
    upload_fmt = "%s-%s-%s" % (upload[:4], upload[4:6], upload[6:8]) if len(upload) == 8 else "미확인"
    today = dt.date.today().isoformat()

    tmp = tempfile.mkdtemp(prefix="ytsubs-")
    run(["yt-dlp", "--skip-download", "--write-subs", "--write-auto-subs",
         "--sub-langs", "ko,ko-orig,en", "--sub-format", "vtt", "--convert-subs", "vtt",
         "-o", os.path.join(tmp, "sub"), "--no-warnings", url], timeout=300)
    vtts = sorted(glob.glob(os.path.join(tmp, "*.vtt")))
    ko_first = sorted(vtts, key=lambda p: (0 if ".ko" in p else 1, p))

    safe_title = re.sub(r"[^\w가-힣 .-]", "", title).strip().replace(" ", "-")[:60]
    os.makedirs(out_dir, exist_ok=True)
    # 파일명 접두사는 수집일이 아니라 영상 업로드일 (콘텐츠의 시점이 곧 정체성)
    prefix = upload_fmt if upload_fmt != "미확인" else today
    out_path = os.path.join(out_dir, "%s-%s.md" % (prefix, safe_title))

    lines = ["---",
             "수집일: %s" % today,
             "게시일: %s" % upload_fmt,
             '출처: "%s"' % url,
             '제목: "%s"' % title.replace('"', "'"),
             "채널: %s" % (meta.get("channel") or meta.get("uploader") or "미확인"),
             "길이_분: %s" % (round(meta["duration"] / 60, 1) if meta.get("duration") else "미확인"),
             "자막: %s" % ("있음" if ko_first else "없음 — 메타데이터만 기록"),
             "---", "",
             "# %s" % title, ""]
    blocks = vtt_to_blocks(ko_first[0]) if ko_first else []
    if blocks:
        lines.append("> 자동 자막 기반 — 고유명사·숫자는 원 영상으로 재확인한다. 인용 시 타임스탬프 병기.")
        lines.append("")
        for sec, text in blocks:
            lines.append("%s %s" % (fmt_ts(sec), text))
            lines.append("")
    else:
        lines.append("(자막 없음 — 필요하면 영상을 직접 시청해 발췌하거나 전사 도구를 쓴다)")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    shutil.rmtree(tmp, ignore_errors=True)
    print(json.dumps({"ok": True, "저장": out_path, "자막": bool(blocks),
                      "블록수": len(blocks)}, ensure_ascii=False))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("query")
    s.add_argument("--limit", type=int, default=10)
    d = sub.add_parser("subs")
    d.add_argument("url")
    d.add_argument("--out-dir", default=".")
    args = p.parse_args()

    require_ytdlp()
    if args.cmd == "search":
        cmd_search(args.query, args.limit)
    else:
        cmd_subs(args.url, args.out_dir)


if __name__ == "__main__":
    main()
