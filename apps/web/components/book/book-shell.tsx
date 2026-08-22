import type { ReactNode } from 'react';
import Link from 'next/link';
import { getManifest } from '@/lib/book/manifest';
import { ContentsSheet } from '@/components/book/contents-sheet';
import { ReadingProgress } from '@/components/book/reading-progress';
import { ThemeToggle } from '@/components/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { appName } from '@/lib/shared';

/**
 * Chrome for the reading surface. Deliberately thin — a 목차 drawer, a theme
 * toggle, and the chapter you're on. No pinned sidebar, no breadcrumb trail,
 * nothing competing with the text for attention.
 */
export async function BookShell({
  children,
  currentBook,
  currentSlug,
  /** Shown in the header center, e.g. `11장 · 매출 추정의 기술`. */
  eyebrow,
  progress = false,
}: {
  children: ReactNode;
  currentBook?: string;
  currentSlug?: string;
  eyebrow?: string;
  progress?: boolean;
}) {
  const manifest = await getManifest();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <ContentsSheet
            manifest={manifest}
            currentBook={currentBook}
            currentSlug={currentSlug}
          />
          <Separator orientation="vertical" className="h-5" />
          <Link
            href="/book"
            className="shrink-0 text-sm font-semibold tracking-tight hover:text-primary"
          >
            {appName}
          </Link>
          {eyebrow ? (
            <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
              {eyebrow}
            </span>
          ) : null}
          <div className="ms-auto flex items-center gap-1">
            <Link
              href="/"
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              리서치
            </Link>
            <ThemeToggle />
          </div>
        </div>
        {progress ? <ReadingProgress /> : null}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
