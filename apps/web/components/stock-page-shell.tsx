import type { ReactNode } from 'react';
import type { Company } from '@investment/schema';
import { CompanyHeader } from '@/components/company-header';
import { StockAnalysisToolbar } from '@/components/stock-analysis-toolbar';

export function StockPageShell({
  company,
  children,
}: {
  company: Company;
  children: ReactNode;
}) {
  return (
    <div>
      <StockAnalysisToolbar stockCode={company.stock_code ?? ''} />
      <CompanyHeader company={company} />
      <div className="p-3">{children}</div>
    </div>
  );
}
