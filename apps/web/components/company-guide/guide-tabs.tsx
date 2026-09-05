'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function GuideTabs({
  title,
  tabs,
}: {
  title?: string;
  tabs: { id: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <section>
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      <div className={cn('flex flex-wrap gap-1 border-b border-border', title && 'mt-3')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              'px-3 py-1.5 text-sm',
              tab.id === current?.id
                ? 'border-b-2 border-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{current?.content}</div>
    </section>
  );
}
