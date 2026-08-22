import { notFound } from 'next/navigation';
import { StockPageShell } from '@/components/stock-page-shell';
import { getCompany } from '@/lib/platform/db';

export default async function CompanyGuideLayout({
  children,
  params,
}: LayoutProps<'/company/[stockCode]'>) {
  const { stockCode } = await params;
  const company = await getCompany(stockCode);
  if (!company) notFound();
  return <StockPageShell company={company}>{children}</StockPageShell>;
}
