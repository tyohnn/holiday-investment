#!/usr/bin/env node
/**
 * Sync ../교재 Markdown → content/docs as Fumadocs pages (+ meta.json).
 *
 * Uses ASCII URL slugs only — Next.js static export can corrupt nested
 * Hangul path segments (truncated folders / client 404s).
 *
 * Run from website/ via `pnpm sync` (also hooked to predev/prebuild).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const SRC = path.join(REPO, '교재');
const DEST = path.join(ROOT, 'content', 'docs');

/** [destSlug, srcBasenameWithoutExt, optional nav title override] */
const BOOK1 = {
  folder: 'book1',
  title: '교재① 방법론',
  pages: [
    { slug: 'index', src: '목차' },
    '---Part A. 투자 철학과 원칙---',
    { slug: 'A1', src: 'A1-투자의-본질' },
    { slug: 'A2', src: 'A2-안전마진과-십루타' },
    { slug: 'A3', src: 'A3-주가의-3요소' },
    { slug: 'A4', src: 'A4-보유-규율' },
    '---Part B. 기업 선정---',
    { slug: 'B1', src: 'B1-능력범위' },
    { slug: 'B2', src: 'B2-경제적-해자와-가격결정권' },
    { slug: 'B3', src: 'B3-산업-분석-프레임' },
    { slug: 'B4', src: 'B4-정성분석-피셔-15포인트' },
    '---Part C. 정량 밸류에이션---',
    { slug: 'C1', src: 'C1-PER-바로-쓰기' },
    { slug: 'C2', src: 'C2-3년후-적정주가-5단계' },
    { slug: 'C3', src: 'C3-매출-추정의-기술' },
    { slug: 'C4', src: 'C4-PSR' },
    { slug: 'C5', src: 'C5-상대가치와-저평가-사다리' },
    '---Part D. 정보 소스---',
    { slug: 'D1', src: 'D1-1차-자료-읽기' },
    { slug: 'D2', src: 'D2-언론-리포트-수급-눈치' },
    '---Part E. 포트폴리오 구성---',
    { slug: 'E1', src: 'E1-자산배분과-8대2' },
    { slug: 'E2', src: 'E2-종목-편입과-구성-5단계' },
    { slug: 'E3', src: 'E3-현금-비중-10-30' },
    '---Part F. 운용---',
    { slug: 'F1', src: 'F1-매도와-종목교체' },
    '---Part G. 심리와 행동 규율---',
    { slug: 'G1', src: 'G1-감정-배제-장치' },
    { slug: 'G2', src: 'G2-수익금-인내-행복' },
    '---Part H. 실전 케이스---',
    { slug: 'H1', src: 'H1-현대차기아-삼양식품' },
    { slug: 'H2', src: 'H2-하이브' },
    { slug: 'H3', src: 'H3-이차전지-8대종목-대장정' },
    { slug: 'H4', src: 'H4-소외-성장주-발굴' },
    '---Part I. 증권 기초 개념---',
    { slug: 'I1', src: 'I1-자금조달과-지분희석' },
    { slug: 'I2', src: 'I2-우선주와-지주회사' },
    { slug: 'I3', src: 'I3-예탁-예금자보호와-파생상품' },
    { slug: 'I4', src: 'I4-시장의-규칙' },
    { slug: 'I5', src: 'I5-세금과-회계의-최소지식' },
    '---부록---',
    { slug: 'appendix', src: '부록-투자자의-태도와-공부법' },
  ],
};

const BOOK2 = {
  folder: 'book2',
  title: '교재② 이차전지',
  pages: [
    { slug: 'index', src: '목차' },
    '---Part A. 이차전지 과학 원리---',
    { slug: 'A1', src: 'A1-전기차와-배터리-흥망사' },
    { slug: 'A2', src: 'A2-이차전지-개념과-구성' },
    { slug: 'A3', src: 'A3-에너지밀도와-하이니켈' },
    { slug: 'A4', src: 'A4-분체기술-전구체-소성' },
    '---Part B. 기술 로드맵---',
    { slug: 'B1', src: 'B1-폼팩터-전쟁-46파이' },
    { slug: 'B2', src: 'B2-제조공정과-건식공정' },
    { slug: 'B3', src: 'B3-미드니켈-LMR-단결정' },
    { slug: 'B4', src: 'B4-차세대-전지' },
    '---Part C. 산업사·정책·지정학---',
    { slug: 'C1', src: 'C1-2020과-2025' },
    { slug: 'C2', src: 'C2-IRA-FEOC-관세' },
    { slug: 'C3', src: 'C3-미중-패권과-중국-변수' },
    { slug: 'C4', src: 'C4-리튬-광물-사이클' },
    '---Part D. 밸류체인 맵---',
    { slug: 'D1', src: 'D1-밸류체인-지도와-채찍효과' },
    { slug: 'D2', src: 'D2-셀-제조사' },
    { slug: 'D3', src: 'D3-양극재-소재-체인' },
    { slug: 'D4', src: 'D4-장비-체인' },
    { slug: 'D5', src: 'D5-특허권' },
    '---Part E. 기업 분석과 주가 평가---',
    { slug: 'E1', src: 'E1-주가의-3요소-폭락-해부' },
    { slug: 'E2', src: 'E2-밸류에이션-공식' },
    { slug: 'E3', src: 'E3-셀3사-적정주가' },
    { slug: 'E4', src: 'E4-양극재3사와-LG화학-우선주' },
    { slug: 'E5', src: 'E5-팩트-추적과-매수-타이밍' },
    '---Part F. 수요 전망과 시장 데이터---',
    { slug: 'F1', src: 'F1-캐즘-데이터-검증' },
    { slug: 'F2', src: 'F2-캐즘-탈출의-신호' },
    { slug: 'F3', src: 'F3-시황-업데이트' },
  ],
};

/** pagePath in content/docs → original 교재 relative path (for GitHub link) */
const SOURCE_MAP = new Map([
  ['index.mdx', 'INDEX.md'],
  ['reference/index.mdx', 'INDEX.md'],
  ['reference/stocks.mdx', '종목/INDEX.md'],
  ['reference/glossary.mdx', '용어교정.md'],
  ['reference/enrichment.mdx', '보강계획.md'],
  ['reference/plan.mdx', 'PLAN.md'],
  ['book1/index.mdx', '교재1-방법론/목차.md'],
  ['book2/index.mdx', '교재2-이차전지/목차.md'],
]);

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function yamlEscape(value) {
  if (value == null) return '""';
  const s = String(value).replace(/\s+/g, ' ').trim();
  if (s === '') return '""';
  if (/[:#{}[\],&*!|>'"%@`]|^\s|\s$/.test(s) || s.includes('\n')) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

function escapeMdx(body) {
  const parts = [];
  const re = /(```[\s\S]*?```|`[^`\n]+`|\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
  let last = 0;
  let m;
  while ((m = re.exec(body)) !== null) {
    parts.push(escapePlain(body.slice(last, m.index)));
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  parts.push(escapePlain(body.slice(last)));
  return parts.join('');
}

function escapePlain(text) {
  let out = text.replace(/<([A-Za-z가-힣/_][^>\n]*)>/g, '&lt;$1&gt;');
  out = out.replace(/(?<!\\)\{/g, '\\{').replace(/(?<!\\)\}/g, '\\}');
  return out;
}

function parseMarkdown(raw) {
  let body = raw.replace(/^\uFEFF/, '');
  let title = '';
  let description = '';

  const h1 = body.match(/^#\s+(.+?)\s*$/m);
  if (h1) {
    title = h1[1].trim();
    body = body.replace(h1[0], '').replace(/^\n+/, '');
  }

  const quote = body.match(/^>\s*(.+)$/m);
  if (quote) {
    description = quote[1].replace(/^>\s*/, '').trim();
  }

  if (!title) title = 'Untitled';
  if (!description) {
    const para = body
      .split(/\n\n+/)
      .map((p) => p.replace(/^[#>*\-\s]+/, '').replace(/\n/g, ' ').trim())
      .find((p) => p.length > 20);
    description = para ? para.slice(0, 160) : title;
  }

  return { title, description, body: escapeMdx(body.trimStart()) };
}

function writeDoc(destPath, title, description, body) {
  mkdirp(path.dirname(destPath));
  const frontmatter = `---
title: ${yamlEscape(title)}
description: ${yamlEscape(description)}
---

`;
  fs.writeFileSync(destPath, frontmatter + body.replace(/\s+$/, '') + '\n', 'utf8');
}

function convertFile(srcFile, destFile, overrides = {}) {
  const raw = fs.readFileSync(srcFile, 'utf8');
  const parsed = parseMarkdown(raw);
  writeDoc(
    destFile,
    overrides.title ?? parsed.title,
    overrides.description ?? parsed.description,
    parsed.body,
  );
}

function navPages(pages) {
  return pages.map((item) => (typeof item === 'string' ? item : item.slug));
}

function syncBook(srcDir, book) {
  const destDir = path.join(DEST, book.folder);
  mkdirp(destDir);
  writeJson(path.join(destDir, 'meta.json'), {
    title: book.title,
    pages: navPages(book.pages),
  });

  for (const item of book.pages) {
    if (typeof item === 'string') continue;
    const srcFile = path.join(srcDir, `${item.src}.md`);
    if (!fs.existsSync(srcFile)) {
      throw new Error(`Missing source: ${srcFile}`);
    }
    const destFile = path.join(destDir, `${item.slug}.mdx`);
    convertFile(srcFile, destFile);
    SOURCE_MAP.set(`${book.folder}/${item.slug}.mdx`, path.join(path.basename(srcDir), `${item.src}.md`));
  }
}

function rewriteIndexLinks(body) {
  return body
    .replace(/\]\(교재1-방법론\/목차\.md\)/g, '](/docs/book1)')
    .replace(/\]\(교재2-이차전지\/목차\.md\)/g, '](/docs/book2)')
    .replace(/\]\(보강계획\.md\)/g, '](/docs/reference/enrichment)')
    .replace(/\]\(용어교정\.md\)/g, '](/docs/reference/glossary)')
    .replace(/\]\(종목\/INDEX\.md\)/g, '](/docs/reference/stocks)')
    .replace(/\]\(PLAN\.md\)/g, '](/docs/reference/plan)')
    .replace(/`\.\.\/우공이산\/노트\/`/g, '`우공이산/노트/`');
}

function writeSourceMap() {
  const obj = Object.fromEntries(SOURCE_MAP);
  fs.writeFileSync(
    path.join(ROOT, 'lib', 'source-map.json'),
    `${JSON.stringify(obj, null, 2)}\n`,
    'utf8',
  );
}

function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Source not found: ${SRC}`);
  }

  rmrf(DEST);
  mkdirp(DEST);

  writeJson(path.join(DEST, 'meta.json'), {
    title: '우공이산 위키',
    pages: ['index', '---교재---', 'book1', 'book2', '---자료---', 'reference'],
  });

  {
    const raw = fs.readFileSync(path.join(SRC, 'INDEX.md'), 'utf8');
    const parsed = parseMarkdown(raw);
    writeDoc(
      path.join(DEST, 'index.mdx'),
      '우공이산 위키',
      '박순혁 투자 방법론 & 이차전지 교재',
      rewriteIndexLinks(parsed.body),
    );
  }

  syncBook(path.join(SRC, '교재1-방법론'), BOOK1);
  syncBook(path.join(SRC, '교재2-이차전지'), BOOK2);

  const refDir = path.join(DEST, 'reference');
  mkdirp(refDir);
  writeJson(path.join(refDir, 'meta.json'), {
    title: '자료',
    pages: ['index', 'stocks', 'glossary', 'enrichment', 'plan'],
  });

  writeDoc(
    path.join(refDir, 'index.mdx'),
    '자료',
    '종목 DB, 용어교정표, 보강계획, 프로젝트 PLAN',
    `강의 노트에서 추출한 보조 자료입니다.

<Cards>
  <Card title="종목 DB" href="/docs/reference/stocks" />
  <Card title="용어교정표" href="/docs/reference/glossary" />
  <Card title="보강계획" href="/docs/reference/enrichment" />
  <Card title="PLAN" href="/docs/reference/plan" />
</Cards>
`,
  );

  convertFile(path.join(SRC, '종목', 'INDEX.md'), path.join(refDir, 'stocks.mdx'), {
    title: '종목 DB',
  });
  convertFile(path.join(SRC, '용어교정.md'), path.join(refDir, 'glossary.mdx'));
  convertFile(path.join(SRC, '보강계획.md'), path.join(refDir, 'enrichment.mdx'));
  convertFile(path.join(SRC, 'PLAN.md'), path.join(refDir, 'plan.mdx'));

  writeSourceMap();

  const count = walkCount(DEST);
  console.log(`Synced ${count} files → ${path.relative(ROOT, DEST)}`);
}

function walkCount(dir) {
  let n = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) n += walkCount(p);
    else n += 1;
  }
  return n;
}

main();
