#!/usr/bin/env node
/**
 * Sync repo-root 교재 Markdown → content/docs as Fumadocs pages (+ meta.json).
 *
 * Uses ASCII URL slugs only — Next.js static export can corrupt nested
 * Hangul path segments (truncated folders / client 404s).
 *
 * Run from apps/web via `pnpm sync` (also hooked to predev/prebuild),
 * or from the monorepo root via `pnpm sync`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../..');
const SRC = path.join(REPO, '교재');
const DEST = path.join(ROOT, 'content', 'docs');

/** [destSlug, srcBasenameWithoutExt, optional nav title override] */
const BOOK1 = {
  folder: 'book1',
  title: '1권: 기업의 가치를 계산하는 법',
  pages: [
    { slug: 'index', src: '목차' },
    '---제1부. 투자 전에 알아야 할 것 — 증권 기초 개념---',
    { slug: 'I1', src: 'I1-자금조달과-지분희석' },
    { slug: 'I2', src: 'I2-우선주와-지주회사' },
    { slug: 'I3', src: 'I3-예탁-예금자보호와-파생상품' },
    { slug: 'I4', src: 'I4-시장의-규칙' },
    { slug: 'I5', src: 'I5-세금과-회계의-최소지식' },
    '---제2부. 투자 철학과 원칙 — 어떤 게임을 하고 있는가---',
    { slug: 'A1', src: 'A1-투자의-본질' },
    { slug: 'A2', src: 'A2-안전마진과-십루타' },
    { slug: 'A3', src: 'A3-주가의-3요소' },
    { slug: 'A4', src: 'A4-보유-규율' },
    '---제3부. 기업 선정 — 어떤 회사를 보는가---',
    { slug: 'B1', src: 'B1-능력범위' },
    { slug: 'B2', src: 'B2-경제적-해자와-가격결정권' },
    { slug: 'B3', src: 'B3-산업-분석-프레임' },
    { slug: 'B4', src: 'B4-정성분석-피셔-15포인트' },
    '---제4부. 정량 밸류에이션 기법---',
    { slug: 'C1', src: 'C1-PER-바로-쓰기' },
    { slug: 'C2', src: 'C2-3년후-적정주가-5단계' },
    { slug: 'C3', src: 'C3-매출-추정의-기술' },
    { slug: 'C4', src: 'C4-PSR' },
    { slug: 'C5', src: 'C5-상대가치와-저평가-사다리' },
    '---제5부. 정보 소스 — 무엇을 읽고 어떻게 해석하는가---',
    { slug: 'D1', src: 'D1-1차-자료-읽기' },
    { slug: 'D2', src: 'D2-언론-리포트-수급-눈치' },
    '---제6부. 포트폴리오 구성---',
    { slug: 'E1', src: 'E1-자산배분과-8대2' },
    { slug: 'E2', src: 'E2-종목-편입과-구성-5단계' },
    { slug: 'E3', src: 'E3-현금-비중-10-30' },
    '---제7부. 운용 — 매도·교체·비중조절---',
    { slug: 'F1', src: 'F1-매도와-종목교체' },
    '---제8부. 심리와 행동 규율---',
    { slug: 'G1', src: 'G1-감정-배제-장치' },
    { slug: 'G2', src: 'G2-수익금-인내-행복' },
    '---제9부. 실전 케이스 라이브러리---',
    { slug: 'H1', src: 'H1-현대차기아-삼양식품' },
    { slug: 'H2', src: 'H2-하이브' },
    { slug: 'H3', src: 'H3-이차전지-8대종목-대장정' },
    { slug: 'H4', src: 'H4-소외-성장주-발굴' },
    '---부록---',
    { slug: 'appendix', src: '부록-투자자의-태도와-공부법' },
  ],
};

const BOOK2 = {
  folder: 'book2',
  title: '2권: 이차전지 산업을 해부하는 법',
  pages: [
    { slug: 'index', src: '목차' },
    '---제1부. 이차전지 과학 원리 — 구성·에너지밀도·소재---',
    { slug: 'A1', src: 'A1-전기차와-배터리-흥망사' },
    { slug: 'A2', src: 'A2-이차전지-개념과-구성' },
    { slug: 'A3', src: 'A3-에너지밀도와-하이니켈' },
    { slug: 'A4', src: 'A4-분체기술-전구체-소성' },
    '---제2부. 기술 로드맵 — 폼팩터·공정·차세대 전지---',
    { slug: 'B1', src: 'B1-폼팩터-전쟁-46파이' },
    { slug: 'B2', src: 'B2-제조공정과-건식공정' },
    { slug: 'B3', src: 'B3-미드니켈-LMR-단결정' },
    { slug: 'B4', src: 'B4-차세대-전지' },
    '---제3부. 산업사·정책·지정학---',
    { slug: 'C1', src: 'C1-2020과-2025' },
    { slug: 'C2', src: 'C2-IRA-FEOC-관세' },
    { slug: 'C3', src: 'C3-미중-패권과-중국-변수' },
    { slug: 'C4', src: 'C4-리튬-광물-사이클' },
    '---제4부. 밸류체인 지도 — 셀·소재·장비·광물·특허---',
    { slug: 'D1', src: 'D1-밸류체인-지도와-채찍효과' },
    { slug: 'D2', src: 'D2-셀-제조사' },
    { slug: 'D3', src: 'D3-양극재-소재-체인' },
    { slug: 'D4', src: 'D4-장비-체인' },
    { slug: 'D5', src: 'D5-특허권' },
    '---제5부. 기업 분석과 주가 평가 (스킬업 케이스 연결)---',
    { slug: 'E1', src: 'E1-주가의-3요소-폭락-해부' },
    { slug: 'E2', src: 'E2-밸류에이션-공식' },
    { slug: 'E3', src: 'E3-셀3사-적정주가' },
    { slug: 'E4', src: 'E4-양극재3사와-LG화학-우선주' },
    { slug: 'E5', src: 'E5-팩트-추적과-매수-타이밍' },
    '---제6부. 수요 전망과 시장 데이터---',
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
title: ${yamlEscape(scrubNames(title))}
description: ${yamlEscape(scrubNames(description))}
---

`;
  fs.writeFileSync(
    destPath,
    frontmatter + scrubNames(body).replace(/\s+$/, '') + '\n',
    'utf8',
  );
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

/** Strip personal/channel names and aliases from published docs (safety net). */
function scrubNames(text) {
  return text
    .replace(/우공이산\s*위키/g, '투자 교재')
    .replace(/우공이산TV/g, '강의TV')
    .replace(/우공이산\s*TV/g, '강의TV')
    .replace(/우공이산\//g, '')
    .replace(/우공이산/g, '강의')
    // ASR channel mishearings of 우공이산
    .replace(/우공사님/g, '강사')
    .replace(
      /우공(?:지산|기산|기사리|기사|이사|이상|회사인|회사|인산|해산|예산|일산|의사인|의사|위산|의\s*산|의산|유산|이삼|인사|상|산|사)/g,
      '강의',
    )
    .replace(/박순혁\s*작가님/g, '강사')
    .replace(/박순혁\s*작가/g, '강사')
    .replace(/박순혁/g, '강사')
    .replace(/박순영\s*작가님?/g, '강사')
    .replace(/박순영\s*강사/g, '강사')
    .replace(/박순영/g, '강사')
    .replace(/박수영\s*작가/g, '강사')
    .replace(/박수영/g, '강사')
    .replace(/박작가님/g, '강사')
    .replace(/박\s*작가님/g, '강사')
    .replace(/박작가/g, '강사')
    .replace(/박\s*작가/g, '강사')
    .replace(/작가님/g, '강사')
    // Host / co-host (박소현) + common ASR mishearings
    .replace(/박소현의\s*/g, '')
    .replace(/박소현\s*앵커님?/g, '강사')
    .replace(/박소현/g, '강사')
    .replace(/박소연의\s*/g, '')
    .replace(/박소연\s*앵커님?/g, '강사')
    .replace(/박소연/g, '강사')
    .replace(/박수현\s*앵커님?/g, '강사')
    .replace(/박수윤\s*(?:앵커님?|강사)/g, '강사')
    .replace(/박수윤/g, '강사')
    .replace(/박선영\s*앵커님?/g, '강사')
    .replace(/박선영님/g, '강사')
    .replace(/박선영컨/g, '강사')
    .replace(/박선영카\s*님?/g, '강사')
    .replace(/박성영\s*앵커님?/g, '강사')
    .replace(/박성영컨님?/g, '강사')
    .replace(/박소영컨/g, '강사')
    .replace(/박소영\s*앵커님?/g, '강사')
    .replace(/박소영/g, '강사')
    .replace(/박선영/g, '강사')
    .replace(/박성영/g, '강사')
    .replace(/박수현의\s*/g, '')
    .replace(/박수현\s*앵커님?/g, '강사')
    .replace(/박수현\s*강사/g, '강사')
    .replace(/박수현님/g, '강사')
    .replace(/박수현이\s*형/g, '강사')
    .replace(/박수현\s*형님/g, '강사')
    .replace(/박수현은/g, '강사는')
    // keep 박수현 의원 (politician); scrub other bare 박수현 as host ASR
    .replace(/박수현(?!\s*의원)/g, '강사')
    .replace(/경제유정/g, '')
    .replace(/경제\s*요정님?/g, '강사')
    .replace(/경기요정\s*/g, '')
    .replace(/배터리\s*아저씨/g, '강사')
    .replace(/밧데리\s*아저씨/g, '강사')
    .replace(/배터리아저씨/g, '강사')
    .replace(/밧데리아저씨/g, '강사')
    .replace(/빠떼아이씨/g, '강사')
    .replace(/빠떼야\s*씨/g, '강사')
    .replace(/빠떼야씨/g, '강사')
    .replace(/빠떼아씨/g, '강사')
    .replace(/빠떼아\s*씨/g, '강사')
    .replace(/빠떼\s*아저씨/g, '강사')
    .replace(/빠떼아저씨/g, '강사')
    .replace(/빠떼아/g, '강사')
    .replace(/빠떼/g, '강사')
    .replace(/빠따야\s*씨/g, '강사')
    .replace(/빠따야시/g, '강사')
    .replace(/빠따야/g, '강사')
    .replace(/바타야시오/g, '강사')
    .replace(/바타야\s*씨/g, '강사')
    .replace(/바타야씨/g, '강사')
    .replace(/바타야/g, '강사')
    .replace(/바테아시아가/g, '강사')
    .replace(/바테아시아/g, '강사')
    .replace(/바테아시/g, '강사')
    .replace(/바테아저씨/g, '강사')
    .replace(/바테아/g, '강사')
    .replace(/밧데렛/g, '강사')
    .replace(/빠제\s*9대/g, '9대')
    .replace(/빠제\s*8대/g, '8대')
    .replace(/빠제/g, '')
    .replace(/빠재\s*신드롬/g, '신드롬')
    .replace(/빠재/g, '')
    .replace(/경제요정/g, '')
    .replace(/경제여정/g, '강의')
    .replace(/박씨모/g, '')
    .replace(/여니의\s*/g, '')
    .replace(/여니/g, '')
    .replace(/5023\s*tv/gi, '강의TV')
    .replace(/5023\s*멤버십/g, '강의 멤버십')
    .replace(/5023\s*유료\s*멤버십/g, '유료 멤버십')
    .replace(/5023\s*라이브/g, '강의 라이브')
    .replace(/5023분들/g, '강의 분들')
    .replace(/5023/g, '강의')
    .replace(/유튜브\s*5024/g, '강의')
    .replace(/우리\s*5024/g, '우리 강의')
    .replace(/5024/g, '강의')
    .replace(/강사\s+강사/g, '강사');
}

function rewriteIndexLinks(body) {
  return scrubNames(
    body
      .replace(/\]\(교재1-방법론\/목차\.md\)/g, '](/docs/book1)')
      .replace(/\]\(교재2-이차전지\/목차\.md\)/g, '](/docs/book2)')
      .replace(/\]\(보강계획\.md\)/g, '](/docs/reference/enrichment)')
      .replace(/\]\(용어교정\.md\)/g, '](/docs/reference/glossary)')
      .replace(/\]\(종목\/INDEX\.md\)/g, '](/docs/reference/stocks)')
      .replace(/\]\(PLAN\.md\)/g, '](/docs/reference/plan)'),
  );
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
    title: '숫자로 읽는 주식투자',
    pages: ['index', '---교재---', 'book1', 'book2', '---자료---', 'reference'],
  });

  {
    const raw = fs.readFileSync(path.join(SRC, 'INDEX.md'), 'utf8');
    const parsed = parseMarkdown(raw);
    writeDoc(
      path.join(DEST, 'index.mdx'),
      '숫자로 읽는 주식투자',
      '기업 가치평가와 이차전지 산업 분석을 다루는 2권 55장 투자 교재',
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
