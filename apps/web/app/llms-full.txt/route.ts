import { getManifest, getReadingOrder, readMarkdown } from '@/lib/book/manifest';

export const revalidate = false;

/**
 * llms-full.txt — every chapter body in reading order, as the Markdown the
 * reader compiles. Served straight from `content/book/` with no MDX layer in
 * between, so what a model sees is what a reader sees.
 */
export async function GET() {
  const manifest = await getManifest();
  const order = await getReadingOrder();

  const chapters = await Promise.all(
    order.map(async ({ book, chapter }) => {
      const body = await readMarkdown(`${book.folder}/${chapter.slug}.md`);
      return `# ${chapter.title} (/book/${book.folder}/${chapter.slug})\n\n${body.trim()}`;
    }),
  );

  const reference = await Promise.all(
    manifest.reference.pages.map(async (page) => {
      const body = await readMarkdown(`reference/${page.slug}.md`);
      return `# ${page.title} (/book/reference/${page.slug})\n\n${body.trim()}`;
    }),
  );

  return new Response(`${[...chapters, ...reference].join('\n\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
