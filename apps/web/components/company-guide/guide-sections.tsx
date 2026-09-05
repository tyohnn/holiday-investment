import type { AnnualSummary } from '@investment/schema';
import type { BoundSection } from '@/lib/company/guide-bound';
import { cn } from '@/lib/cn';
import { FinancialChart } from '@/app/(app)/lab/[stockCode]/_components/financial-chart';
import { GuideTabs } from './guide-tabs';
import { GuideTreeTable } from './guide-tree-table';

function SectionHead({ title, note }: { title?: string; note?: string }) {
  if (!title && !note) return null;
  return (
    <div>
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function KvGrid({
  title,
  items,
  compact,
}: {
  title: string;
  items: { id: string; label: string; value: string; empty: boolean }[];
  compact?: boolean;
}) {
  return (
    <section>
      <SectionHead title={title} />
      <dl
        className={cn(
          'mt-3 grid gap-x-6 gap-y-2 rounded-xl border border-border bg-card p-4 text-sm',
          compact ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {items.map((item) => (
          <div key={item.id} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className={cn('truncate font-medium tabular-nums', item.empty && 'text-muted-foreground')}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ChartSlot({
  title,
  series,
  filled,
  annual,
}: {
  title: string;
  series: string[];
  filled?: 'financial';
  annual: AnnualSummary[];
}) {
  if (filled === 'financial' && annual.length > 0) {
    return (
      <section>
        <SectionHead title={title} />
        <div className="mt-3 rounded-xl border border-border bg-card p-4">
          <FinancialChart data={annual} />
        </div>
      </section>
    );
  }
  return (
    <section>
      <SectionHead title={title} />
      <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
        <p className="font-medium text-foreground/80">차트 슬롯 · 적재 전</p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {series.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RecordsTable({
  title,
  columns,
  rows,
  note,
}: {
  title: string;
  columns: { id: string; label: string }[];
  rows: string[][];
  note?: string;
}) {
  return (
    <section>
      <SectionHead title={title} note={note} />
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {columns.map((col) => (
                <th key={col.id} className="px-3 py-2 text-left font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={columns.length}>
                  —
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={cn('px-3 py-2', cell === '—' && 'text-muted-foreground', j > 0 && 'tabular-nums')}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function GuideSections({
  sections,
  annual,
}: {
  sections: BoundSection[];
  annual: AnnualSummary[];
}) {
  return (
    <div className="space-y-6">
      {sections.map((section) => {
        switch (section.kind) {
          case 'kpis':
            return <KvGrid key={section.id} title={section.title} items={section.items} compact />;
          case 'kv':
            return <KvGrid key={section.id} title={section.title} items={section.items} />;
          case 'chart':
            return (
              <ChartSlot
                key={section.id}
                title={section.title}
                series={section.series}
                filled={section.filled}
                annual={annual}
              />
            );
          case 'tree-table':
            return (
              <GuideTreeTable
                key={section.id}
                title={section.title}
                columns={section.columns}
                rows={section.rows}
                note={section.note}
              />
            );
          case 'records':
            return (
              <RecordsTable
                key={section.id}
                title={section.title}
                columns={section.columns}
                rows={section.rows}
                note={section.note}
              />
            );
          case 'tabs':
            return (
              <GuideTabs
                key={section.id}
                title={section.title}
                tabs={section.tabs.map((tab) => ({
                  id: tab.id,
                  label: tab.label,
                  content: <GuideSections sections={tab.sections} annual={annual} />,
                }))}
              />
            );
          case 'iframe':
            return (
              <section key={section.id}>
                <SectionHead title={section.title} />
                <iframe
                  title={section.title}
                  src={section.src}
                  className="mt-3 h-[720px] w-full rounded-xl border border-border bg-card"
                />
              </section>
            );
          case 'note':
            return (
              <section key={section.id}>
                <SectionHead title={section.title} />
                <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  {section.text}
                </p>
              </section>
            );
        }
      })}
    </div>
  );
}
