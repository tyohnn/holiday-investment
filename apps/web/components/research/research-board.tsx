'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import GridLayout, { useContainerWidth, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import type { ResearchBoard, ResearchGroup, ResearchWidget } from '@/lib/research';
import { cn } from '@/lib/cn';

function storageKey(boardSlug: string, groupId: string): string {
  return `research-board:${boardSlug}:${groupId}`;
}

function readLayout(boardSlug: string, groupId: string, fallback: Layout): Layout {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(boardSlug, groupId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    return parsed as Layout;
  } catch {
    return fallback;
  }
}

function writeLayout(boardSlug: string, groupId: string, layout: Layout) {
  try {
    window.localStorage.setItem(storageKey(boardSlug, groupId), JSON.stringify(layout));
  } catch {
    /* ignore quota */
  }
}

export function ResearchBoardCanvas({ board }: { board: ResearchBoard }) {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 pb-16 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">리서치 보드</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{board.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{board.tagline}</p>
      </header>

      {board.groups.map((group) => (
        <ResearchGroupGrid key={group.id} boardSlug={board.slug} group={group} />
      ))}
    </div>
  );
}

function ResearchGroupGrid({
  boardSlug,
  group,
}: {
  boardSlug: string;
  group: ResearchGroup;
}) {
  const { width, containerRef, mounted } = useContainerWidth();
  const defaultLayout = useMemo(
    () => group.widgets.map((widget) => widget.layout),
    [group.widgets],
  );
  const [layout, setLayout] = useState<Layout>(() => readLayout(boardSlug, group.id, defaultLayout));

  const onLayoutChange = useCallback(
    (next: Layout) => {
      setLayout(next);
      writeLayout(boardSlug, group.id, next);
    },
    [boardSlug, group.id],
  );

  return (
    <section className="rounded-2xl border border-border bg-card/40">
      <header className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold tracking-tight">{group.title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{group.summary}</p>
      </header>
      <div ref={containerRef} className="research-grid px-3 py-3 sm:px-4">
        {mounted && width > 0 && (
          <GridLayout
            width={width}
            layout={layout}
            gridConfig={{ cols: 12, rowHeight: 36, margin: [12, 12] }}
            dragConfig={{ enabled: true, handle: '.research-drag' }}
            resizeConfig={{ enabled: true }}
            onLayoutChange={onLayoutChange}
            className="min-h-[12rem]"
          >
            {group.widgets.map((widget) => (
              <div key={widget.id} className="h-full">
                <ResearchWidgetCard widget={widget} />
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </section>
  );
}

function ResearchWidgetCard({ widget }: { widget: ResearchWidget }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex items-start gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          className="research-drag mt-0.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="위치 이동"
        >
          <DotsSixVerticalIcon className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{widget.title}</h3>
          {widget.source && (
            <p className="truncate text-[11px] text-muted-foreground">{widget.source}</p>
          )}
        </div>
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
            widget.kind === 'news' && 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
            widget.kind === 'note' && 'bg-muted text-muted-foreground',
            widget.kind === 'metric' && 'bg-primary/10 text-primary',
            widget.kind === 'link' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            widget.kind === 'chart' && 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
          )}
        >
          {kindLabel(widget.kind)}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2 text-sm">
        {widget.kind === 'metric' && widget.metric && (
          <div>
            <p className="text-2xl font-semibold tracking-tight">{widget.metric.value}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {widget.metric.caption}
            </p>
          </div>
        )}
        {widget.body && <p className="text-xs leading-relaxed text-muted-foreground">{widget.body}</p>}
        {widget.items && widget.items.length > 0 && (
          <ul className="space-y-2">
            {widget.items.map((item) => (
              <li key={item.title} className="rounded-lg bg-muted/50 px-2.5 py-2">
                {item.href ? (
                  <Link href={item.href} className="text-xs font-medium text-primary hover:underline">
                    {item.title}
                  </Link>
                ) : (
                  <p className="text-xs font-medium">{item.title}</p>
                )}
                {item.note && (
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {widget.href && (
          <Link
            href={widget.href}
            className="mt-2 inline-flex text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {widget.hrefLabel ?? '열기'}
          </Link>
        )}
      </div>
    </article>
  );
}

function kindLabel(kind: ResearchWidget['kind']): string {
  switch (kind) {
    case 'chart':
      return '차트';
    case 'news':
      return '뉴스';
    case 'note':
      return '노트';
    case 'metric':
      return '지표';
    case 'link':
      return '링크';
  }
}
