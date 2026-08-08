import { notFound } from 'next/navigation';
import { getCompany } from '@/lib/platform/db';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from './_components/dashboard-sidebar';
import { DashboardTopbar } from './_components/dashboard-topbar';

export default async function StockAnalysisLayout({
  children,
  params,
}: LayoutProps<'/lab/[stockCode]'>) {
  const { stockCode } = await params;
  const company = await getCompany(stockCode);
  if (!company) notFound();

  return (
    <SidebarProvider>
      <DashboardSidebar company={company} />
      <SidebarInset>
        <DashboardTopbar company={company} />
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
