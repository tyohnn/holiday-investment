'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import {
  ArrowsLeftRightIcon,
  BinocularsIcon,
  BookOpenTextIcon,
  BuildingsIcon,
  CalculatorIcon,
  CaretDownIcon,
  ChartLineUpIcon,
  ChartPieSliceIcon,
  CompassIcon,
  FactoryIcon,
  FileTextIcon,
  FlowArrowIcon,
  GavelIcon,
  GlobeHemisphereEastIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  MagnifyingGlassIcon,
  NewspaperClippingIcon,
  PercentIcon,
  PulseIcon,
  ScalesIcon,
  ShieldCheckIcon,
  SquaresFourIcon,
  TableIcon,
  UsersThreeIcon,
  type IconProps,
} from '@phosphor-icons/react';
import { appName } from '@/lib/shared';
import { BOARDS, type BoardId } from '@/lib/analysis';
import { COMPANY_MENUS, companyHref, type CompanyMenuId } from '@/lib/company';
import { parseStockPath } from '@/lib/platform/company-index';
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
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const COMPANY_ICON: Record<CompanyMenuId, ComponentType<IconProps>> = {
  snapshot: SquaresFourIcon,
  profile: BuildingsIcon,
  financials: TableIcon,
  ratios: PercentIcon,
  indicators: ChartLineUpIcon,
  consensus: UsersThreeIcon,
  ownership: ChartPieSliceIcon,
  sector: FactoryIcon,
  peers: ArrowsLeftRightIcon,
  'exchange-filings': NewspaperClippingIcon,
  'fss-filings': ScalesIcon,
};

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
  const { state: sidebarState } = useSidebar();
  const { companies, setOpen, openSearch } = useSymbolCommand();
  const { stockCode, menuSlug } = parseStockPath(pathname);
  const company = companies.find((item) => item.stock_code === stockCode);
  const onLab = pathname.startsWith('/lab/');
  const iconCollapsed = sidebarState === 'collapsed';
  const [boardsOpen, setBoardsOpen] = useState(onLab);

  useEffect(() => {
    if (onLab) setBoardsOpen(true);
  }, [onLab]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-12 justify-center border-b border-sidebar-border p-0 px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton type="button" onClick={() => setOpen(true)}>
              {company ? (
                <>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
                    {company.name.slice(0, 1)}
                  </span>
                  <span className="truncate text-sm font-semibold">{company.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                    {company.stock_code}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground">
                    <MagnifyingGlassIcon className="size-3.5" />
                  </span>
                  <span className="truncate text-sm font-semibold">종목 검색</span>
                </>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>기업정보</SidebarGroupLabel>
          <SidebarMenu>
            {COMPANY_MENUS.map((menu) => {
              const href = stockCode ? companyHref(stockCode, menu.slug) : undefined;
              const active = Boolean(href && menuSlug === menu.slug);
              const Icon = COMPANY_ICON[menu.id];
              return (
                <SidebarMenuItem key={menu.id}>
                  {href ? (
                    <SidebarMenuButton asChild isActive={active} tooltip={menu.title}>
                      <Link href={href}>
                        <Icon weight={active ? 'fill' : 'regular'} />
                        <span className="truncate">{menu.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      type="button"
                      tooltip={menu.title}
                      onClick={() => openSearch({ menuSlug: menu.slug })}
                    >
                      <Icon />
                      <span className="truncate">{menu.title}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <Collapsible
          open={iconCollapsed || boardsOpen}
          onOpenChange={(next) => {
            if (!iconCollapsed) setBoardsOpen(next);
          }}
          className="group/collapsible"
        >
          <SidebarGroup>
            <SidebarGroupLabel
              asChild
              className="cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <CollapsibleTrigger>
                <ListNumbersIcon />
                <span className="flex-1 truncate text-left">분석 순서</span>
                <CaretDownIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
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
                          type="button"
                          tooltip={`${board.step}. ${board.title} — ${board.question}`}
                          onClick={() => openSearch({ boardSlug: board.slug })}
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
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator className="mb-1" />
        <SidebarMenu>
          {GLOBAL_LINKS.map((link) => {
            const active =
              link.href === '/company'
                ? pathname === '/company'
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
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
