import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BookShell } from '@/components/book/book-shell';
import { TypesetBody } from '@/components/book/typeset-body';
import { ChapterOutline } from '@/components/book/chapter-outline';
import { ChapterNav } from '@/components/book/chapter-nav';
import { getChapter, getManifest, readMarkdown } from '@/lib/book/manifest';
import { renderMarkdown } from '@/lib/book/render';
import { gitConfig } from '@/lib/shared';
import sourceMap from '@/lib/source-map.json';

export async function generateStaticParams() {
  const manifest = await getManifest();
  return manifest.books.flatMap((book) =>
    book.parts.flatMap((part) =>
      part.chapters.map((chapter) => ({ book: book.folder, chapter: chapter.slug })),
    ),
  );
}

export async function generateMetadata(
  props: PageProps<'/book/[book]/[chapter]'>,
): Promise<Metadata> {
  const { book, chapter } = await props.params;
  const found = await getChapter(book, chapter);
  if (!found) return {};
  return {
    title: found.location.chapter.title,
    description: found.location.chapter.description,
  };
}

/** One chapter, set as a page of a book. */
export default async function ChapterPage(props: PageProps<'/book/[book]/[chapter]'>) {
  const { book: folder, chapter: slug } = await props.params;
  const found = await getChapter(folder, slug);
  if (!found) notFound();

  const { location, previous, next, position, total } = found;
  const { chapter, part } = location;
  const { blocks, toc } = await renderMarkdown(await readMarkdown(`${folder}/${slug}.md`));

  const sourcePath = (sourceMap as Record<string, string>)[`${folder}/${slug}.md`];
  const eyebrow = chapter.number
    ? `${chapter.number}장 · ${chapter.heading}`
    : chapter.heading;

  return (
    <BookShell currentBook={folder} currentSlug={slug} eyebrow={eyebrow} progress>
      <div className="mx-auto w-full max-w-7xl px-6 xl:grid xl:grid-cols-[12rem_minmax(0,1fr)_12rem] xl:gap-8">
        {/* Empty mirror of the outline rail so the text measure stays centered
            on the page rather than drifting left of it. */}
        <div className="hidden xl:block" />

        <article className="book-flow min-w-0 py-16 sm:py-20">
          <header className="mb-12">
            {part.title ? (
              <p className="text-xs tracking-wide text-muted-foreground">{part.title}</p>
            ) : null}
            {chapter.number ? (
              <p className="mt-6 text-sm font-medium tracking-[0.08em] text-primary tabular-nums">
                {chapter.number}장
              </p>
            ) : null}
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance break-keep sm:text-[2.5rem] sm:leading-[1.15]">
              {chapter.heading}
            </h1>
            {chapter.subtitle ? (
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-balance break-keep">
                {chapter.subtitle}
              </p>
            ) : null}
          </header>

          <TypesetBody blocks={blocks} />

          <footer className="mt-16 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-6 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {position} / {total}
            </span>
            {sourcePath ? (
              <a
                href={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/교재/${sourcePath}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                원문 마크다운
              </a>
            ) : null}
            <Link href={`/book/${folder}`} className="hover:text-foreground">
              목차로
            </Link>
          </footer>

          <ChapterNav previous={previous} next={next} />
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-24 max-h-[calc(100svh-8rem)] overflow-y-auto py-16">
            <ChapterOutline toc={toc} />
          </div>
        </aside>
      </div>
    </BookShell>
  );
}
