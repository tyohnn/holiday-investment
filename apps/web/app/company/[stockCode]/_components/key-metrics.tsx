import { formatPercent, formatWon, type AnnualSummary } from '@investment/schema';

export function KeyMetrics({ latest }: { latest: AnnualSummary }) {
  const cards: { label: string; value: string; sub?: string }[] = [
    { label: '매출액', value: `${formatWon(latest.revenue)}원`, sub: `${latest.bsns_year}년` },
    { label: '영업이익률', value: formatPercent(latest.opm_pct) },
    { label: 'ROE', value: formatPercent(latest.roe_pct) },
    { label: '부채비율', value: formatPercent(latest.debt_ratio_pct) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-fd-border bg-fd-card p-4">
          <div className="text-xs text-fd-muted-foreground">
            {c.label}
            {c.sub && <span className="ml-1 opacity-70">({c.sub})</span>}
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
