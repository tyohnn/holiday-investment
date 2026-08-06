import Link from 'next/link';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getManifest } from '@/lib/book/manifest';
import { appName } from '@/lib/shared';

/**
 * Two things live here: the book (the 교재, read at `/book`) and the research
 * platform (`/industry`, `/company`). The landing page only has to make that
 * split obvious.
 */
export default async function HomePage() {
  const manifest = await getManifest();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-end px-6">
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
        <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">
          투자 교재
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance break-keep">
          {appName}
        </h1>
        <p className="mt-5 leading-relaxed text-muted-foreground">
          {manifest.description}. 모든 서술은 강의 출처를 인용합니다.
        </p>

        <div className="mt-10 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/book">
              교재 읽기
              <ArrowRightIcon />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/industry">산업 지도</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/company">종목 분석</Link>
          </Button>
        </div>

        <ul className="mt-12 space-y-1 border-t pt-6 text-sm">
          {manifest.books.map((book) => (
            <li key={book.folder}>
              <Link
                href={`/book/${book.folder}`}
                className="inline-flex items-center gap-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="tabular-nums">{book.label}</span>
                <span>{book.title.replace(/^\d+권:\s*/, '')}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
