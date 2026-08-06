import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BookShell } from '@/components/book/book-shell';
import { TypesetBody } from '@/components/book/typeset-body';
import { ChapterOutline } from '@/components/book/chapter-outline';
import { getManifest, readMarkdown } from '@/lib/book/manifest';
import { renderMarkdown } from '@/lib/book/render';

export async function generateStaticParams() {
  const manifest = await getManifest();
  return manifest.reference.pages.map((page) => ({ slug: page.slug }));
}

async function findPage(slug: string) {
  const manifest = await getManifest();
  return manifest.reference.pages.find((page) => page.slug === slug);
}

export async function generateMetadata(
  props: PageProps<'/book/reference/[slug]'>,
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await findPage(slug);
  if (!page) return {};
  return { title: page.title, description: page.description };
}

/** 자료 — the reference material behind the books (종목 DB, 용어교정표). */
export default async function ReferencePage(props: PageProps<'/book/reference/[slug]'>) {
  const { slug } = await props.params;
  const page = await findPage(slug);
  if (!page) notFound();

  const { blocks, toc } = await renderMarkdown(await readMarkdown(`reference/${slug}.md`));

  return (
    <BookShell currentBook="reference" currentSlug={slug} eyebrow={page.title} progress>
      <div className="mx-auto w-full max-w-7xl px-6 xl:grid xl:grid-cols-[12rem_minmax(0,1fr)_12rem] xl:gap-8">
        <div className="hidden xl:block" />

        <article className="book-flow min-w-0 py-16 sm:py-20">
          <header className="mb-12">
            <p className="text-xs tracking-wide text-muted-foreground">자료</p>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance break-keep">
              {page.title}
            </h1>
          </header>

          <TypesetBody blocks={blocks} />
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
