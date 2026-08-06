import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCompany } from '@/lib/platform/db';
import { sectorName } from '@investment/schema';
import { AnalysisSidebar } from './_components/analysis-sidebar';

export default async function StockAnalysisLayout({
  children,
  params,
}: LayoutProps<'/company/[stockCode]'>) {
  const { stockCode } = await params;
  const company = await getCompany(stockCode);
  if (!company) notFound();

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-56">
        <div className="mb-4 rounded-xl border border-border bg-card p-3 lg:mb-6">
          <Link
            href={`/company/${stockCode}/revenue`}
            className="block text-base font-semibold tracking-tight hover:text-primary"
          >
            {company.name}
          </Link>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {company.stock_code}
            {company.market ? ` · ${company.market}` : ''}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sectorName(company.sector_code) ?? '업종 미상'}
            {company.ceo ? ` · ${company.ceo}` : ''}
          </p>
        </div>
        <AnalysisSidebar stockCode={stockCode} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
