import { classifySector, type Company } from '@investment/schema';
import { Badge } from '@/components/ui/badge';
import { formatKoDate } from './format';

export function CompanyHeader({ company }: { company: Company }) {
  const items: { label: string; value: string }[] = [
    { label: '대표이사', value: company.ceo ?? '—' },
    { label: '결산월', value: company.fiscal_month ? `${company.fiscal_month}월` : '—' },
    { label: '설립일', value: formatKoDate(company.established) },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      {/* Faint brand-tinted glow in the corner — restrained, not a full gradient wash. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
          {company.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{company.name}</h1>
            <span className="font-mono text-sm text-muted-foreground">{company.stock_code}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {company.market && <Badge variant="secondary">{company.market}</Badge>}
            <Badge variant="outline">
              {classifySector(company.sector_code, company.stock_code)?.industryName ?? '업종 미상'}
            </Badge>
          </div>
        </div>
      </div>
      <dl className="relative mt-5 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-4 text-sm sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
