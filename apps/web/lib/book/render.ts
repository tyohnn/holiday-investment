import 'server-only';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { toString as hastToString } from 'hast-util-to-string';
import { visit } from 'unist-util-visit';
import type { Element, Root } from 'hast';

/**
 * A chapter body is a list of blocks so live React components can sit between
 * runs of compiled Markdown. Everything the author wrote is `html`; the chart
 * placeholders `scripts/sync-content.mjs` leaves behind become `chart`.
 */
export type Block = { kind: 'html'; html: string } | { kind: 'chart'; id: string };

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface RenderedChapter {
  blocks: Block[];
  toc: TocEntry[];
}

/** Collect h2/h3 ids for the in-chapter outline. Must run after rehype-slug. */
function collectToc(toc: TocEntry[]) {
  return () => (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const depth = node.tagName === 'h2' ? 2 : node.tagName === 'h3' ? 3 : null;
      const id = node.properties?.id;
      if (!depth || typeof id !== 'string') return;
      toc.push({ id, text: hastToString(node), depth });
    });
  };
}

/**
 * Wide blocks scroll inside their own box rather than squeezing the column —
 * shadcn/typeset styles `.typeset-scroll` for exactly this, and this textbook
 * is full of multi-column number tables that are unreadable when compressed.
 */
function wrapWideBlocks() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'table') return;
      if (!parent || index === undefined) return;
      if (parent.type === 'element' && parent.properties?.className) {
        const className = parent.properties.className;
        if (Array.isArray(className) && className.includes('typeset-scroll')) return;
      }
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['typeset-scroll'] },
        children: [node],
      };
    });
  };
}

const CHART_BLOCK_RE = /<p>@@TEXTBOOK_CHART:([^@<]+)@@<\/p>/g;

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // Single-$ math stays off: the textbook writes USD amounts as $1,000.
  // Display math still works via $$…$$.
  .use(remarkMath, { singleDollarTextMath: false })
  .use(remarkRehype, {
    footnoteLabel: '출처',
    footnoteBackLabel: '본문으로',
    // Default is `sr-only`, a Tailwind utility that isn't generated for
    // runtime-produced HTML anyway. Readers of a cited textbook want the label.
    footnoteLabelProperties: { className: ['typeset-footnote-label'] },
  })
  .use(rehypeKatex)
  .use(rehypeSlug)
  .use(wrapWideBlocks)
  .use(rehypeStringify);

/** Compile one chapter's Markdown into typeset-ready blocks + its outline. */
export async function renderMarkdown(markdown: string): Promise<RenderedChapter> {
  const toc: TocEntry[] = [];
  const file = await processor().use(collectToc(toc)).process(markdown);
  return { blocks: splitChartBlocks(String(file)), toc };
}

function splitChartBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  let last = 0;

  for (const match of html.matchAll(CHART_BLOCK_RE)) {
    const before = html.slice(last, match.index);
    if (before.trim()) blocks.push({ kind: 'html', html: before });
    blocks.push({ kind: 'chart', id: match[1] });
    last = match.index + match[0].length;
  }

  const rest = html.slice(last);
  if (rest.trim()) blocks.push({ kind: 'html', html: rest });
  return blocks;
}
