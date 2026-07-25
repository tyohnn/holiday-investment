import { sectorName, type Company } from '@investment/schema';
import { formatKoDate } from './format';

export function CompanyHeader({ company }: { company: Company }) {
  const items: { label: string; value: string }[] = [
    { label: '종목코드', value: company.stock_code ?? '—' },
    { label: '시장', value: company.market ?? '—' },
    { label: '업종', value: sectorName(company.sector_code) ?? '—' },
    { label: '대표이사', value: company.ceo ?? '—' },
    { label: '결산월', value: company.fiscal_month ? `${company.fiscal_month}월` : '—' },
    { label: '설립일', value: formatKoDate(company.established) },
  ];

  return (
    <div className="rounded-xl border border-fd-border bg-fd-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{company.name}</h1>
        <span className="font-mono text-sm text-fd-muted-foreground">{company.stock_code}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-fd-muted-foreground">{item.label}</dt>
            <dd className="font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
