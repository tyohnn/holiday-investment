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
  PulseIcon,
  ShieldCheckIcon,
  type IconProps,
} from '@phosphor-icons/react';
import { classifySector, type Company } from '@investment/schema';
import { appName } from '@/lib/shared';
import { BOARDS, type BoardId, type DataState } from '@/lib/analysis';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/theme-toggle';
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

/**
 * 데이터 상태 점. 어떤 단계가 공시로 이미 채워졌고 어떤 단계가 AI 분석을 기다리는지
 * 사이드바에서 바로 읽히게 한다 — 들어가 보고 나서야 비어 있는 걸 아는 게 최악이다.
 */
const STATE_DOT: Record<DataState, string> = {
  live: 'bg-positive',
  partial: 'bg-chart-3',
  agent: 'bg-muted-foreground/35',
};

const GLOBAL_LINKS = [
  { href: '/company', label: '종목 목록', icon: ListBulletsIcon },
  { href: '/industry', label: '산업 지도', icon: GlobeHemisphereEastIcon },
  { href: '/book', label: '교재', icon: BookOpenTextIcon },
];

export function DashboardSidebar({ company }: { company: Company }) {
  const pathname = usePathname();
  const stockCode = company.stock_code;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={company.name}>
              <Link href={`/lab/${stockCode}/verdict`}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
                  {company.name.slice(0, 1)}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold">{company.name}</span>
                  <span className="truncate font-mono text-[10px] text-sidebar-foreground/60">
                    {stockCode} · {classifySector(company.sector_code, stockCode)?.industryName ?? '업종 미상'}
                  </span>
                </span>
              </Link>
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
              const href = `/lab/${stockCode}/${board.slug}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const Icon = BOARD_ICON[board.id];
              return (
                <SidebarMenuItem key={board.id}>
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
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator className="mb-1" />
        <SidebarMenu>
          {GLOBAL_LINKS.map((link) => (
            <SidebarMenuItem key={link.href}>
              <SidebarMenuButton asChild tooltip={link.label}>
                <Link href={link.href}>
                  <link.icon />
                  <span>{link.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
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
