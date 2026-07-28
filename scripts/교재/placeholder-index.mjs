#!/usr/bin/env node
/**
 * 교재 본문의 <!-- MEDIA --> / <!-- QUIZ --> placeholder를 훑어
 * 교재/placeholder-index.md 를 다시 만든다.
 *
 * 실행: node scripts/교재/placeholder-index.mjs (저장소 루트에서)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, '교재');
const BOOKS = [
  ['book1', '교재1-방법론'],
  ['book2', '교재2-이차전지'],
];

const rows = { MEDIA: [], QUIZ: [] };

for (const [prefix, dir] of BOOKS) {
  const abs = path.join(SRC, dir);
  for (const name of fs.readdirSync(abs).sort()) {
    if (!name.endsWith('.md')) continue;
    const text = fs.readFileSync(path.join(abs, name), 'utf8');
    const re = /<!--\s*(MEDIA|QUIZ):([\w|-]+)\s+id="([^"]+)"\s*-->\s*\n>\s*\*\*\[([^\]]+)\]\*\*\s*(.*)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const [, kind, type, id, tag, title] = m;
      rows[kind].push({ id, type, file: `${dir}/${name}`, title: title.trim() || tag, prefix });
    }
  }
}

const table = (list) =>
  ['| id | 종류 | 파일 | 설명 |', '|---|---|---|---|']
    .concat(list.map((r) => `| \`${r.id}\` | ${r.type} | \`${r.file}\` | ${r.title} |`))
    .join('\n');

const out = `# Placeholder 목록

> 이 파일은 \`scripts/교재/placeholder-index.mjs\`가 본문에서 자동 생성한다. 직접 고치지 않는다.
> 집계: MEDIA **${rows.MEDIA.length}** · QUIZ **${rows.QUIZ.length}**

집필 기준은 [\`_집필스타일.md\`](_집필스타일.md) §7을 따른다. 도표는 말로 설명하기 어려운 것에만 장당 0~2개, 퀴즈 블록은 원칙적으로 쓰지 않고 \`직접 해보기\`로 녹인다.

## MEDIA (도표·그래프·이미지)

${rows.MEDIA.length ? table(rows.MEDIA) : '_아직 없음._'}

## QUIZ (퀴즈·연습)

${rows.QUIZ.length ? table(rows.QUIZ) : '_없음. \`직접 해보기\` 절로 대체한다._'}
`;

fs.writeFileSync(path.join(SRC, 'placeholder-index.md'), out, 'utf8');
console.log(`placeholder-index.md 재생성 — MEDIA ${rows.MEDIA.length} · QUIZ ${rows.QUIZ.length}`);
