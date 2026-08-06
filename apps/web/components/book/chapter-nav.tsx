import Link from 'next/link';
import { ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import type { ChapterLocation } from '@/lib/book/types';

/** Turn-the-page footer. Two wide targets, the way a reader actually moves. */
export function ChapterNav({
  previous,
  next,
}: {
  previous: ChapterLocation | null;
  next: ChapterLocation | null;
}) {
  if (!previous && !next) return null;

  return (
    <nav
      aria-label="장 이동"
      className="mt-16 grid gap-3 border-t pt-6 sm:grid-cols-2"
    >
      {previous ? <NavCard location={previous} direction="prev" /> : <span />}
      {next ? <NavCard location={next} direction="next" /> : null}
    </nav>
  );
}

function NavCard({
  location,
  direction,
}: {
  location: ChapterLocation;
  direction: 'prev' | 'next';
}) {
  const isNext = direction === 'next';

  return (
    <Link
      href={location.href}
      rel={isNext ? 'next' : 'prev'}
      className={`group flex flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-muted/60 ${
        isNext ? 'sm:col-start-2 sm:text-right' : ''
      }`}
    >
      <span
        className={`flex items-center gap-1.5 text-xs text-muted-foreground ${
          isNext ? 'sm:justify-end' : ''
        }`}
      >
        {isNext ? null : <ArrowLeftIcon className="size-3" />}
        {isNext ? '다음' : '이전'}
        {isNext ? <ArrowRightIcon className="size-3" /> : null}
      </span>
      <span className="text-sm font-medium group-hover:text-primary">
        {location.chapter.number ? `${location.chapter.number}장 · ` : ''}
        {location.chapter.heading}
      </span>
    </Link>
  );
}
