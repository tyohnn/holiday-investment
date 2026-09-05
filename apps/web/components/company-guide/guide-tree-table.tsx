'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import type { BoundRow } from '@/lib/company/guide-bound';

function collectOpenIds(rows: BoundRow[], into: Set<string>) {
  for (const row of rows) {
    if (row.children.length > 0) {
      into.add(row.id);
      collectOpenIds(row.children, into);
    }
  }
}

function hasNested(row: BoundRow): boolean {
  return row.children.length > 0;
}

export function GuideTreeTable({
  title,
  columns,
  rows,
  note,
}: {
  title: string;
  columns: { id: string; label: string }[];
  rows: BoundRow[];
  note?: string;
}) {
  const allOpen = useMemo(() => {
    const ids = new Set<string>();
    collectOpenIds(rows, ids);
    return ids;
  }, [rows]);
  const [open, setOpen] = useState<Set<string>>(allOpen);

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visible: BoundRow[] = [];
  const walk = (list: BoundRow[], ancestorsOpen: boolean) => {
    for (const row of list) {
      if (!ancestorsOpen) continue;
      visible.push(row);
      if (hasNested(row) && open.has(row.id)) walk(row.children, true);
    }
  };
  walk(rows, true);

  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">계정</th>
              {columns.map((col) => (
                <th key={col.id} className="px-3 py-2 text-right font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((row) => {
              const nested = hasNested(row);
              const isOpen = open.has(row.id);
              return (
                <tr key={row.id} className={row.level === 0 ? 'bg-card' : undefined}>
                  <td className="px-3 py-2">
                    <div
                      className="flex items-start gap-1.5"
                      style={{ paddingLeft: row.level * 16 }}
                    >
                      {nested ? (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label="계산에 참여한 계정 펼치기"
                          onClick={() => toggle(row.id)}
                          className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded border border-border text-[10px] font-medium text-muted-foreground hover:bg-muted"
                        >
                          {isOpen ? '−' : '+'}
                        </button>
                      ) : (
                        <span className="inline-block size-5 shrink-0" />
                      )}
                      <div>
                        <div className={cn(row.level === 0 && 'font-semibold')}>{row.label}</div>
                        {row.formula && (
                          <div className="text-[11px] text-muted-foreground">{row.formula}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  {row.cells.map((cell, i) => (
                    <td
                      key={`${row.id}-${columns[i]?.id ?? i}`}
                      className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        cell.empty && 'text-muted-foreground',
                      )}
                    >
                      {cell.text}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
