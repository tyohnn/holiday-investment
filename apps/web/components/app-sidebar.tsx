'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import {
  BinocularsIcon,
  BookOpenTextIcon,
  CalculatorIcon,
  CompassIcon,
  FileTextIcon,
  FlowArrowIcon,
  GavelIcon,
  GlobeHemisphereEastIcon,
  ListBulletsIcon,
  MagnifyingGlassIcon,
  PulseIcon,
  ShieldCheckIcon,
  type IconProps,
} from '@phosphor-icons/react';
import { appName } from '@/lib/shared';
import { BOARDS, type BoardId } from '@/lib/analysis';
import { companyIndustryName, parseLabPath } from '@/lib/platform/company-index';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/theme-toggle';
import { useSymbolCommand } from '@/components/symbol-command';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';

const BOARD_ICON: Record<BoardId, ComponentType<IconProps>> = {
  verdict: GavelIcon,
  circle: CompassIcon,
  primary: FileTextIcon,
  moat: ShieldCheckIcon,
  industry: FlowArrowIcon,
  valuation: CalculatorIcon,
  'price-factors': PulseIcon,
  watch: BinocularsIcon,
};

const STATE_DOT: Record<string, string> = {
  live: 'bg-positive',
  partial: 'bg-chart-3',
  agent: 'bg-muted-foreground/35',
};

const GLOBAL_LINKS = [
  { href: '/company', label: '종목 목록', icon: ListBulletsIcon },
  { href: '/industry', label: '산업 지도', icon: GlobeHemisphereEastIcon },
  { href: '/book', label: '교재', icon: BookOpenTextIcon },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { companies, setOpen } = useSymbolCommand();
  const { stockCode } = parseLabPath(pathname);
  const company = companies.find((item) => item.stock_code === stockCode);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              type="button"
              className="h-12"
              onClick={() => setOpen(true)}
            >
                {company ? (
                  <>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
                      {company.name.slice(0, 1)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm font-semibold">{company.name}</span>
                      <span className="truncate font-mono text-[10px] text-sidebar-foreground/60">
                        {company.stock_code} · {companyIndustryName(company)}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground">
                      <MagnifyingGlassIcon className="size-3.5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm font-semibold">종목 검색</span>
                      <span className="truncate text-[10px] text-sidebar-foreground/60">
                        종목명 또는 코드
                      </span>
                    </span>
                  </>
                )}
                <MagnifyingGlassIcon className="size-3.5 shrink-0 text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>분석 순서</SidebarGroupLabel>
          <SidebarMenu>
            {BOARDS.map((board) => {
              const href = stockCode ? `/lab/${stockCode}/${board.slug}` : undefined;
              const active = Boolean(href && (pathname === href || pathname.startsWith(`${href}/`)));
              const Icon = BOARD_ICON[board.id];
              return (
                <SidebarMenuItem key={board.id}>
                  {href ? (
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={`${board.step}. ${board.title} — ${board.question}`}
                    >
                      <Link href={href}>
                        <Icon weight={active ? 'fill' : 'regular'} />
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="font-mono text-[10px] tabular-nums text-sidebar-foreground/45">
                            {board.step}
                          </span>
                          <span className="truncate">{board.title}</span>
                        </span>
                        <span
                          aria-hidden
                          className={cn(
                            'size-1.5 shrink-0 rounded-full group-data-[collapsible=icon]:hidden',
                            STATE_DOT[board.dataState],
                          )}
                        />
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      disabled
                      tooltip="종목을 먼저 고르세요"
                    >
                      <Icon />
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="font-mono text-[10px] tabular-nums text-sidebar-foreground/45">
                          {board.step}
                        </span>
                        <span className="truncate">{board.title}</span>
                      </span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator className="mb-1" />
        <SidebarMenu>
          {GLOBAL_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton asChild isActive={active} tooltip={link.label}>
                  <Link href={link.href}>
                    <link.icon />
                    <span>{link.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        <div className="flex items-center justify-between px-1 pt-1 group-data-[collapsible=icon]:hidden">
          <span className="truncate text-[10px] text-sidebar-foreground/50">{appName}</span>
          <ThemeToggle />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
