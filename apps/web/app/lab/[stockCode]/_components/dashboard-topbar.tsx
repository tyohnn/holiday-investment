'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Company } from '@investment/schema';
import { BOARDS } from '@/lib/analysis';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function DashboardTopbar({ company }: { company: Company }) {
  const pathname = usePathname();
  const onProducts = pathname.endsWith('/products') || pathname.includes('/products/');
  const board = BOARDS.find((b) => {
    const href = `/lab/${company.stock_code}/${b.slug}`;
    return pathname === href || pathname.startsWith(`${href}/`);
  });

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/60 sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <nav
        className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
        aria-label="이동 경로"
      >
        <Link href="/company" className="shrink-0 hover:text-foreground">
          종목 목록
        </Link>
        <span aria-hidden className="text-border">
          /
        </span>
        <span className="truncate font-medium text-foreground">{company.name}</span>
        {onProducts && (
          <>
            <span aria-hidden className="text-border">
              /
            </span>
            <Link
              href={`/lab/${company.stock_code}/circle`}
              className="truncate hover:text-foreground"
            >
              능력범위
            </Link>
            <span aria-hidden className="text-border">
              /
            </span>
            <span className="truncate">제품 지도</span>
          </>
        )}
        {board && !onProducts && (
          <>
            <span aria-hidden className="text-border">
              /
            </span>
            <span className="truncate">
              <span className="font-mono text-xs tabular-nums text-muted-foreground/70">
                {board.step}.
              </span>{' '}
              {board.title}
            </span>
          </>
        )}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {company.market && (
          <Badge variant="outline" className="font-mono">
            {company.market} · {company.stock_code}
          </Badge>
        )}
      </div>
    </header>
  );
}
