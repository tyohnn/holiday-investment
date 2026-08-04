import Link from 'next/link';
import type { ReactNode } from 'react';
import { TRUST_LABELS, type AnalysisWidgetMeta, type TrustLevel } from '@/lib/analysis';
import { isHiddenDocsHref } from '@/lib/hidden-books';

const TRUST_CLASS: Record<TrustLevel, string> = {
  filing: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  ir: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  news: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  estimate: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  secondary: 'bg-fd-muted text-fd-muted-foreground',
};

export function WidgetShell({
  meta,
  claim,
  evidence,
  children,
  empty,
  emptyHint = '데이터 없음 / 수집 필요',
}: {
  meta: AnalysisWidgetMeta;
  /** 런타임 주장 — 없으면 meta.claim */
  claim?: string;
  evidence?: string;
  children?: ReactNode;
  empty?: boolean;
  emptyHint?: string;
}) {
  const displayClaim = claim ?? meta.claim;
  // Textbook deep-links may target a hidden book (see lib/hidden-books.ts) — drop
  // those rather than link to a page that doesn't exist.
  const visibleTextbooks = meta.textbooks.filter((t) => !isHiddenDocsHref(t.href));

  return (
    <article className="flex flex-col rounded-xl border border-fd-border bg-fd-card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold leading-snug">{meta.title}</h3>
          {meta.question && (
            <p className="text-xs text-fd-muted-foreground">질문: {meta.question}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${TRUST_CLASS[meta.trust]}`}
        >
          {TRUST_LABELS[meta.trust]}
        </span>
      </header>

      <p className="mt-3 text-sm leading-relaxed text-fd-foreground">{displayClaim}</p>

      {evidence && (
        <p className="mt-1.5 text-xs text-fd-muted-foreground">근거: {evidence}</p>
      )}

      <div className="mt-3 min-h-0 flex-1">
        {empty ? (
          <p className="rounded-lg border border-dashed border-fd-border px-3 py-6 text-center text-xs text-fd-muted-foreground">
            {emptyHint}
          </p>
        ) : (
          children
        )}
      </div>

      {visibleTextbooks.length > 0 && (
        <footer className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-fd-border pt-3 text-xs">
          <span className="text-fd-muted-foreground">방법론</span>
          {visibleTextbooks.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="text-fd-primary underline-offset-2 hover:underline"
            >
              {t.label}
            </Link>
          ))}
        </footer>
      )}
    </article>
  );
}
