# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
This is primarily (1) a Bash **YouTube → transcription pipeline** and
(2) an authored **Korean Markdown knowledge base** (`교재/`, `강의/`).
There is also a pnpm monorepo front-end under `apps/web` (Fumadocs/Next.js) that
serves `교재/` — run from repo root with `pnpm install` / `pnpm dev`. Shared
packages can go in `packages/*`. The knowledge-base Markdown remains the core
deliverable; the site is a viewer over it.

### Web app + platform (apps/web + Supabase) — the runnable application
`pnpm install` (root) then `pnpm dev` serves the site at http://localhost:3000 (Next.js 16
+ Turbopack). `predev` runs `scripts/sync-content.mjs` which regenerates the gitignored
`apps/web/content/docs/` from `교재/` (≈112 files). Node 22 + pnpm 10.x are used; the
update script runs `pnpm install`.

- **`/docs/**` works standalone** — pure Fumadocs viewer over `교재/`, no backend needed.
- **`/company/**` needs the local Supabase stack** (`apps/web/lib/platform/db.ts` reads
  PostgREST at `http://127.0.0.1:54321` with the built-in local anon key, so **no env vars
  are required** — just have the stack running). Without it, `/company` 500s.
  `/company/<stockCode>` 307-redirects to `/company/<stockCode>/revenue`. Seeded stock codes:
  `259960` (크래프톤), `247540` (에코프로비엠).
- `pnpm types:check` (root) = the lint/build proxy (`fumadocs-mdx && next typegen && tsc --noEmit`).

**Running the Supabase stack (for `/company`)** — see `platform/README.md` for the full
data workflow; the non-obvious cloud gotchas are:
- Requires Docker + the `supabase` CLI (installed to `$HOME/.local/share/supabase`, must be
  on `PATH`). On a fresh Cloud VM these may be absent — install Docker per the Cloud Agent
  Docker workaround, and with **Docker 29** set `/etc/docker/daemon.json` to
  `{"storage-driver":"fuse-overlayfs","features":{"containerd-snapshotter":false}}` or
  `supabase start` containers fail to build.
- Start: `export PATH="$HOME/.local/share/supabase:$PATH"; cd platform && supabase start`
  (applies migrations + auto-loads `seed.sql`: 2 companies, 1426 filings, etc.).
- **`filing_sections` (3,052 rows) is a separate compressed seed** and must be loaded once
  by hand. The host has no `psql`; pipe it through the db container instead:
  `gunzip -c supabase/seed-filing-sections.sql.gz | docker exec -i supabase_db_platform psql postgresql://postgres:postgres@127.0.0.1:5432/postgres`

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

<!-- oh-my-docs:start -->
# Oh My Docs

This repository uses a docs-first workflow. Canonical product intent lives in
**one** handbook SSOT — either local docs (`docs/content/docs` or
`apps/docs/content/docs`) or Notion — never more than one as authoritative.

## Content source (SSOT)

1. Read `.omd/project.json` and use `contentSource.ssot`
   (`local` | `notion`).
2. Missing `contentSource` means `local`.
3. If `.omd/project.json` is missing, run `inspect` / ask the user to choose
   SSOT and `adopt` before inventing handbook files.
4. For `local`, edit the Fumadocs MDX tree. For `notion`, edit the single
   Home page: only `# 도메인` / `# 기획` / `# 개발` section headers, with
   catalog DBs stacked inline under them (no per-catalog headings, no child
   pages, no sidebar) via the host Notion MCP. Do not treat an unselected
   provider as truth.

## Documentation is always first

Any decision, agreement, requirement, design choice, open question, or new
discussion that should outlive this chat must be written into the selected SSOT
— not left only in conversation.

1. Before and during the talk, check whether the topic already exists in the SSOT.
2. Create or update the matching handbook artifacts as the discussion progresses.
3. Catalog entries (PRD, story, plan, ADR, …) go in the **catalog store** — a
   Notion inline database row on Home, or a local catalog folder +
   `meta.json` — never as ad-hoc child pages. **Planning ≠ Plans**:
   implementation plans belong in Plans (`dbs.plans`).
4. Prefer `node <skill>/scripts/omd.mjs new <kind> --title "…" --yes` (local)
   or the Notion catalog workflow (notion) over ad-hoc files or chat-only notes.
5. Run `node <skill>/scripts/omd.mjs check` after meaningful documentation edits.
<!-- oh-my-docs:end -->
