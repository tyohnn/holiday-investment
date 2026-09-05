import { classifySector, type Company } from '@investment/schema';
import { Badge } from '@/components/ui/badge';

function formatKoDate(date: string | null | undefined): string {
  if (!date) return '—';
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return date;
  return `${m[1]}.${m[2]}.${m[3]}`;
}

function Slot({ label, value }: { label: string; value: string }) {
  const empty = value === '—';
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={empty ? 'text-muted-foreground' : 'font-medium'}>{value}</dd>
    </div>
  );
}

export function CompanyHeader({ company }: { company: Company }) {
  const fiscal = company.fiscal_month ? `${company.fiscal_month}월 결산` : '—';
  const sector = classifySector(company.sector_code, company.stock_code)?.industryName ?? '업종 미상';

  return (
    <div className="relative overflow-hidden border-b border-border bg-card px-4 py-3">
      <div className="relative min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{company.name}</h1>
          <span className="font-mono text-sm text-muted-foreground">
            {company.stock_code ?? '—'} · {fiscal}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          홈페이지 — · 전화번호 — · 주소 —
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {company.market && <Badge variant="secondary">{company.market}</Badge>}
          <Badge variant="outline">{sector}</Badge>
          <Badge variant="outline">WI26 —</Badge>
          <Badge variant="outline">K200 —</Badge>
          <Badge variant="outline">NXT —</Badge>
        </div>
      </div>
      <dl className="relative mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-3 text-sm sm:grid-cols-5">
        <Slot label="PER" value="—" />
        <Slot label="PER(Fwd.12M)" value="—" />
        <Slot label="업종 PER" value="—" />
        <Slot label="PBR" value="—" />
        <Slot label="현금배당수익률" value="—" />
      </dl>
      <dl className="relative mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-3 text-sm sm:grid-cols-3">
        <Slot label="대표이사" value={company.ceo ?? '—'} />
        <Slot label="결산월" value={company.fiscal_month ? `${company.fiscal_month}월` : '—'} />
        <Slot label="설립일" value={formatKoDate(company.established)} />
      </dl>
    </div>
  );
}
