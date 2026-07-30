import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    // Disable single-$ math: textbook uses $ for USD amounts ($1,000).
    // Display math still works via $$...$$.
    remarkPlugins: [[remarkMath, { singleDollarTextMath: false }]],
    rehypePlugins: [rehypeKatex],
    // GFM footnotes (remark-gfm is already in the Fumadocs default preset).
    remarkRehypeOptions: {
      footnoteLabel: '출처',
      footnoteBackLabel: '본문으로',
    },
  },
});
