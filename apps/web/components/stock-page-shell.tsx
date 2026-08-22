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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-12 z-[9]">
        <CompanyHeader company={company} />
      </div>
      <div className="min-w-0 flex-1 p-3">{children}</div>
    </div>
  );
}
