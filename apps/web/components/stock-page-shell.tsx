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
    <div>
      <CompanyHeader company={company} />
      <div className="p-3">{children}</div>
    </div>
  );
}
