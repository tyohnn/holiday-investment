# Project skills

Committed agent skills (unlike gitignored `.agents/`).

| Skill | Purpose |
|---|---|
| [`korean-bestseller-prose`](korean-bestseller-prose/SKILL.md) | 베스트셀러형 한글 논픽션·교재 작법 (소설 도입·웹소설 호흡·링크드인 스캔·비문학 증거) |

로컬 Cursor/Claude Code용으로 쓰려면:

```bash
mkdir -p .agents/skills
cp -a skills/korean-bestseller-prose .agents/skills/
ln -sfn ../../.agents/skills/korean-bestseller-prose .claude/skills/korean-bestseller-prose
```

조사 근거: `research/domain-korean-prose-craft-2026-07-29.md`
