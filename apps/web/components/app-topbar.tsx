'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BOARDS } from '@/lib/analysis';
import { parseLabPath } from '@/lib/platform/company-index';
import { useSymbolCommand } from '@/components/symbol-command';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function AppTopbar() {
  const pathname = usePathname();
  const { companies } = useSymbolCommand();
  const { stockCode } = parseLabPath(pathname);
  const company = companies.find((item) => item.stock_code === stockCode);
  const board = BOARDS.find((item) => {
    if (!stockCode) return false;
    const href = `/lab/${stockCode}/${item.slug}`;
    return pathname === href || pathname.startsWith(`${href}/`);
  });

  const crumbs: { href?: string; label: string; mono?: boolean }[] = [{ href: '/', label: '홈' }];
  if (pathname === '/company' || pathname.startsWith('/company/')) {
    crumbs.push({ label: '종목 목록' });
  } else if (pathname === '/industry' || pathname.startsWith('/industry/')) {
    crumbs.push({ href: '/industry', label: '산업 지도' });
  } else if (company) {
    crumbs.push({ label: company.name });
    if (board) {
      crumbs.push({ label: `${board.step}. ${board.title}` });
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/60 sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <nav
        className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
        aria-label="이동 경로"
      >
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            {index > 0 && (
              <span aria-hidden className="text-border">
                /
              </span>
            )}
            {crumb.href ? (
              <Link href={crumb.href} className="shrink-0 hover:text-foreground">
                {crumb.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'truncate',
                  index === crumbs.length - 1 && 'font-medium text-foreground',
                )}
              >
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {company?.market && (
          <Badge variant="outline" className="font-mono">
            {company.market} · {company.stock_code}
          </Badge>
        )}
      </div>
    </header>
  );
}
