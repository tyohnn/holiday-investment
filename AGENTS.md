# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
This is primarily (1) a Bash **YouTube → transcription pipeline** and
(2) an authored **Korean Markdown knowledge base** (`교재/`, `강의/`).
There is also a pnpm monorepo front-end under `apps/web` (Fumadocs/Next.js) that
serves `교재/` — run from repo root with `pnpm install` / `pnpm dev`. Shared
packages can go in `packages/*`. The knowledge-base Markdown remains the core
deliverable; the site is a viewer over it.

### Dependencies (pre-installed in the VM snapshot)
The pipeline shells out to these CLI tools (no code-level packages exist):
- `yt-dlp` — installed at `/usr/local/bin/yt-dlp` (standalone binary)
- `ffmpeg` / `ffprobe` — from apt
- `whisper-cli` — whisper.cpp built from source, installed to `/usr/local/bin`
  (shared libs in `/usr/local/lib`, registered via `ldconfig`)
- Whisper model — `~/models/whisper-ggml/ggml-large-v3-turbo-q5_0.bin` (~548 MB),
  the exact path/model the scripts expect.

### Non-obvious caveats
- **The pipeline scripts do NOT run as-is on this Linux VM.** `run-all.sh`,
  `predownload.sh`, `transcribe.sh`, and `redo.sh` are hardcoded to the author's macOS
  environment: `ROOT="/Users/titanism/projects/주식공부/강의"` (absent here),
  `df -g` and `stat -f%z` (macOS-only), and `--cookies-from-browser "chrome:Profile 1"`.
  Do not expect them to work unedited.
- **The download phase cannot run in the cloud.** YouTube blocks this datacenter IP with
  "Sign in to confirm you're not a bot" unless cookies are supplied, and the target
  playlists are paid membership content requiring the author's Chrome cookies. `yt-dlp`
  is installed and reaches YouTube, but downloads need cookies that aren't available here.
- **The transcription CORE is fully runnable and is the smoke test.** Reproduce what the
  scripts do internally, on any local audio file:
  ```bash
  ffmpeg -y -loglevel error -i INPUT -vn -ac 1 -ar 16000 -c:a pcm_s16le out.16k.wav
  whisper-cli -m ~/models/whisper-ggml/ggml-large-v3-turbo-q5_0.bin \
    -f out.16k.wav -l ko -otxt -osrt -of RESULT -t 8 -mc 0 -pp
  ```
  This produces `RESULT.txt` + `RESULT.srt`, exactly like `transcribe.sh`.
- **If you ever rebuild whisper.cpp:** the default `c++` is clang targeting a gcc-14
  toolchain that lacks `libstdc++` dev (`cannot find -lstdc++`). Configure with
  `cmake -B build -DCMAKE_C_COMPILER=gcc -DCMAKE_CXX_COMPILER=g++`.
- There is no lint/test/build. To sanity-check a script, use `bash -n script.sh`.
- `.claude/skills/*` symlinks point into the gitignored `.agents/` dir and are expected to
  be broken in a fresh checkout.
- The `investment-analyst` plugin (기업·산업 분석 스킬 팩) lives in `plugin/` — a self-contained
  plugin bundled for all three tools' own native plugin systems: `.claude-plugin/`,
  `.cursor-plugin/`, `.codex-plugin/` each hold a manifest pointing at the shared `skills/`
  folder (no per-tool file copies, no dependency on `교재/`). No `commands/` — Claude Code
  autotriggers skills by description, Cursor invokes them directly (`/company-analysis`), and
  Codex's plugin manifest doesn't support commands anyway. Its reports go to `리서치/`. See
  `plugin/README.md` for each tool's native install steps. Platform-wide plan lives in `로드맵.md`.
- `*.sh.superseded` files are deprecated and not part of the active pipeline.
