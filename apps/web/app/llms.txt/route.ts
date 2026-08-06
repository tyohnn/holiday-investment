import { getManifest } from '@/lib/book/manifest';

export const revalidate = false;

/** llms.txt — the shelf as an outline, one link per chapter. */
export async function GET() {
  const manifest = await getManifest();
  const lines = [`# ${manifest.title}`, '', `> ${manifest.description}`, ''];

  for (const book of manifest.books) {
    lines.push(`## ${book.title}`, '');
    for (const part of book.parts) {
      if (part.title) lines.push(`### ${part.title}`, '');
      for (const chapter of part.chapters) {
        lines.push(
          `- [${chapter.title}](/book/${book.folder}/${chapter.slug}): ${chapter.description}`,
        );
      }
      lines.push('');
    }
  }

  lines.push(`## ${manifest.reference.title}`, '');
  for (const page of manifest.reference.pages) {
    lines.push(`- [${page.title}](/book/reference/${page.slug}): ${page.description}`);
  }

  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
