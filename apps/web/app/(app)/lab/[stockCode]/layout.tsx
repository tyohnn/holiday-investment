import { notFound } from 'next/navigation';
import { getCompany } from '@/lib/platform/db';

export default async function StockAnalysisLayout({
  children,
  params,
}: LayoutProps<'/lab/[stockCode]'>) {
  const { stockCode } = await params;
  const company = await getCompany(stockCode);
  if (!company) notFound();
  return children;
}
