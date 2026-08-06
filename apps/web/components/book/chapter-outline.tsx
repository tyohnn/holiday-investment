'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import type { TocEntry } from '@/lib/book/render';

/**
 * Slim outline of the current chapter, pinned beside the text on wide screens.
 * Tracks the heading you're reading so the rail says where you are without
 * needing a click.
 */
export function ChapterOutline({ toc }: { toc: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string>(toc[0]?.id ?? '');

  useEffect(() => {
    if (toc.length === 0) return;

    const headings = toc
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      // Top band only: a heading counts as "current" once it reaches the
      // upper third, which is where the eye sits while reading.
      { rootMargin: '-96px 0px -66% 0px', threshold: 0 },
    );

    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [toc]);

  if (toc.length === 0) return null;

  return (
    <nav aria-label="이 장의 목차" className="text-xs leading-relaxed">
      <p className="mb-2 font-medium tracking-wide text-muted-foreground">이 장에서</p>
      <ul className="space-y-1 border-l">
        {toc.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={activeId === entry.id ? 'true' : undefined}
              className={cn(
                '-ml-px block border-l py-0.5 text-muted-foreground transition-colors',
                'hover:border-foreground/40 hover:text-foreground',
                entry.depth === 3 && 'pl-6',
                entry.depth === 2 && 'pl-3',
                activeId === entry.id && 'border-primary text-foreground',
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
