import type { ReactNode } from 'react';
import type { Company } from '@investment/schema';
import { CompanyHeader } from '@/components/company-header';

export function StockPageShell({
  company,
  children,
}: {
  company: Company;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0">
        <CompanyHeader company={company} />
      </div>
      <div data-slot="stock-page-body" className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
        {children}
      </div>
    </div>
  );
}
