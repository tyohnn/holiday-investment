#!/usr/bin/env bash
# Cursor Cloud start 한 줄. Runtime Secrets → .env.local
# 값이 없어도 에이전트 기동을 막지 않는다(경고만).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$ROOT/scripts/sync-runtime-env.py" --root "$ROOT"
