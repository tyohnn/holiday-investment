import { notFound } from 'next/navigation';
import { StockPageShell } from '@/components/stock-page-shell';
import { getCompany } from '@/lib/platform/db';

export default async function StockAnalysisLayout({
  children,
  params,
}: LayoutProps<'/lab/[stockCode]'>) {
  const { stockCode } = await params;
  const company = await getCompany(stockCode);
  if (!company) notFound();
  return <StockPageShell company={company}>{children}</StockPageShell>;
}
