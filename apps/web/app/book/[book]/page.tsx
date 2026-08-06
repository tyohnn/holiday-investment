import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BookShell } from '@/components/book/book-shell';
import { TypesetBody } from '@/components/book/typeset-body';
import { getBook, getManifest, readMarkdown } from '@/lib/book/manifest';
import { renderMarkdown } from '@/lib/book/render';
import { Separator } from '@/components/ui/separator';

export async function generateStaticParams() {
  const manifest = await getManifest();
  return manifest.books.map((book) => ({ book: book.folder }));
}

export async function generateMetadata(
  props: PageProps<'/book/[book]'>,
): Promise<Metadata> {
  const { book: folder } = await props.params;
  const book = await getBook(folder);
  if (!book) return {};
  return { title: book.title, description: book.intro?.description };
}

/**
 * A book's title page and 목차.
 *
 * The contents list is built from `manifest.json` — i.e. from the chapters'
 * own H1s — so the 장 numbers and links are always what the chapters actually
 * say. The authored 목차 file follows underneath as an expanded contents.
 */
export default async function BookPage(props: PageProps<'/book/[book]'>) {
  const { book: folder } = await props.params;
  const book = await getBook(folder);
  if (!book) notFound();

  const chapterCount = book.parts.reduce((n, part) => n + part.chapters.length, 0);
  const intro = book.intro
    ? await renderMarkdown(await readMarkdown(`${folder}/index.md`))
    : null;

  return (
    <BookShell currentBook={folder} eyebrow={book.title}>
      <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
        <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">
          {book.label}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance break-keep sm:text-4xl">
          {book.title.replace(/^\d+권:\s*/, '')}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {book.parts.length}부 · {chapterCount}장
        </p>

        <Separator className="my-12" />

        <nav aria-label="목차" className="space-y-10">
          {book.parts.map((part) => (
            <section key={part.title}>
              {part.title ? (
                <h2 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground">
                  {part.title}
                </h2>
              ) : null}
              <ul className="divide-y border-y">
                {part.chapters.map((chapter) => (
                  <li key={chapter.slug}>
                    <Link
                      href={`/book/${folder}/${chapter.slug}`}
                      className="group flex items-baseline gap-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="w-8 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                        {chapter.number ?? '—'}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium group-hover:text-primary">
                          {chapter.heading}
                        </span>
                        {chapter.subtitle ? (
                          <span className="mt-0.5 block text-sm text-muted-foreground">
                            {chapter.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        {intro ? (
          <section className="mt-20">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
              장별 핵심 내용
            </h2>
            <div className="book-flow mt-6">
              <TypesetBody blocks={intro.blocks} />
            </div>
          </section>
        ) : null}
      </div>
    </BookShell>
  );
}
