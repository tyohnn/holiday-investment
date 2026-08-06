import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRightIcon, BookOpenIcon } from '@phosphor-icons/react/dist/ssr';
import { BookShell } from '@/components/book/book-shell';
import { getManifest } from '@/lib/book/manifest';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: '서가',
};

/** The shelf: pick a 권, or jump to the reference material. */
export default async function BookIndexPage() {
  const manifest = await getManifest();

  return (
    <BookShell>
      <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-28">
        <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">
          투자 교재
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {manifest.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {manifest.description}. 모든 서술은 강의 출처를 인용합니다.
        </p>

        <Separator className="my-12" />

        <ul className="space-y-4">
          {manifest.books.map((book) => {
            const chapters = book.parts.reduce((n, part) => n + part.chapters.length, 0);
            return (
              <li key={book.folder}>
                <Link
                  href={`/book/${book.folder}`}
                  className="group flex items-start gap-4 rounded-xl border p-5 transition-colors hover:bg-muted/60"
                >
                  <BookOpenIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-medium group-hover:text-primary">
                      {book.title}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {book.parts.length}부 · {chapters}장
                    </span>
                  </span>
                  <ArrowRightIcon className="mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>

        <section className="mt-12">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
            {manifest.reference.title}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {manifest.reference.pages.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/book/reference/${page.slug}`}
                  className="inline-flex rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </BookShell>
  );
}
