import { notFound } from 'next/navigation';
import { getCompany } from '@/lib/platform/db';

export default async function CompanyGuideLayout({
  children,
  params,
}: LayoutProps<'/company/[stockCode]'>) {
  const { stockCode } = await params;
  const company = await getCompany(stockCode);
  if (!company) notFound();
  return children;
}
