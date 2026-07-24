#!/usr/bin/env bash
# investment-analyst 플러그인을 Cursor / Codex 로 세팅한다.
# (Claude Code 는 플러그인 매니페스트를 직접 인식하므로 스크립트가 필요 없다 — 아래 안내 참조.)
#
# 사용법:
#   ./install.sh [대상프로젝트경로]     # 기본값: 현재 디렉토리
#
# 하는 일:
#   - Cursor: <대상>/.cursor/rules 와 .cursor/commands 에 어댑터를 설치
#   - Codex : <대상>/AGENTS.md 에 스킬 블록을 추가하고, ~/.codex/prompts 에 프롬프트를 설치

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$(pwd)}"
TARGET="$(cd "$TARGET" && pwd)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"

echo "플러그인 위치 : $PLUGIN_DIR"
echo "설치 대상     : $TARGET"
echo

subst() { sed "s|{{PLUGIN_DIR}}|$PLUGIN_DIR|g" "$1"; }

# --- Cursor -----------------------------------------------------------------
echo "[Cursor] .cursor/rules, .cursor/commands 설치"
mkdir -p "$TARGET/.cursor/rules" "$TARGET/.cursor/commands"
subst "$PLUGIN_DIR/adapters/cursor/rules/investment-analyst.mdc" \
  > "$TARGET/.cursor/rules/investment-analyst.mdc"
for f in "$PLUGIN_DIR"/adapters/cursor/commands/*.md; do
  subst "$f" > "$TARGET/.cursor/commands/$(basename "$f")"
done
echo "  → .cursor/rules/investment-analyst.mdc"
echo "  → .cursor/commands/analyze-company.md, analyze-industry.md"
echo "  Cursor 에서 /analyze-company, /analyze-industry 로 호출."
echo

# --- Codex ------------------------------------------------------------------
echo "[Codex] AGENTS.md 블록 + ~/.codex/prompts 설치"
AGENTS="$TARGET/AGENTS.md"
if [ -f "$AGENTS" ] && grep -q "investment-analyst:start" "$AGENTS"; then
  echo "  AGENTS.md 에 이미 블록 존재 — 건너뜀 (수동 갱신하려면 블록을 지우고 재실행)"
else
  { [ -f "$AGENTS" ] && echo; subst "$PLUGIN_DIR/adapters/codex/AGENTS.snippet.md"; } >> "$AGENTS"
  echo "  → AGENTS.md 에 스킬 블록 추가"
fi
mkdir -p "$CODEX_HOME/prompts"
for f in "$PLUGIN_DIR"/adapters/codex/prompts/*.md; do
  subst "$f" > "$CODEX_HOME/prompts/$(basename "$f")"
done
echo "  → $CODEX_HOME/prompts/analyze-company.md, analyze-industry.md"
echo "  Codex 에서 /analyze-company, /analyze-industry 로 호출."
echo

# --- Claude Code ------------------------------------------------------------
echo "[Claude Code] 플러그인은 매니페스트로 직접 설치한다:"
echo "  claude"
echo "  > /plugin marketplace add $PLUGIN_DIR"
echo "  > /plugin install investment-analyst@investment-analyst-marketplace"
echo "  (또는 이 저장소처럼 .claude/ 하위에 두면 자동 인식)"
echo
echo "완료. company-analysis·industry-analysis 스킬을 세 도구에서 쓸 수 있다."
