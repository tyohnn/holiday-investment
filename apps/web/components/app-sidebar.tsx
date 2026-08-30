'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenTextIcon,
  ChartLineUpIcon,
  GlobeHemisphereEastIcon,
  NewspaperClippingIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react';
import { appName } from '@/lib/shared';
import {
  THEME_SECTIONS,
  THEMES,
  parseAppPath,
  sectionHref,
  themeHref,
  type ThemeId,
  type ThemeSectionId,
} from '@/lib/nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { PathCombobox } from '@/components/path-combobox';
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

const SECTION_ICON: Record<ThemeSectionId, typeof SquaresFourIcon> = {
  analysis: SquaresFourIcon,
  macro: GlobeHemisphereEastIcon,
  news: NewspaperClippingIcon,
  boards: ChartLineUpIcon,
};

export function AppSidebar() {
  const pathname = usePathname();
  const { theme, section, stockCode } = parseAppPath(pathname);
  const themeMeta = THEMES.find((item) => item.id === theme) ?? THEMES[0];

  function sectionTarget(id: ThemeSectionId): string {
    if (theme === 'stocks' && id === 'analysis' && stockCode) {
      return `/stocks/analysis/${stockCode}`;
    }
    return sectionHref(theme, id);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-12 justify-center border-b border-sidebar-border p-0 px-2">
        <div className="flex min-w-0 items-center gap-1 group-data-[collapsible=icon]:justify-center">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
            {themeMeta.label.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <PathCombobox
              value={theme}
              label={themeMeta.label}
              placeholder="테마"
              className="h-8 w-full justify-between px-1.5"
              groups={[
                {
                  items: THEMES.map((item) => ({
                    value: item.id,
                    label: item.label,
                    href: keepSectionOnThemeChange(item.id, section),
                    hint: item.description,
                  })),
                },
              ]}
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{themeMeta.label}</SidebarGroupLabel>
          <SidebarMenu>
            {THEME_SECTIONS.map((item) => {
              const href = sectionTarget(item.id);
              const active = section === item.id;
              const Icon = SECTION_ICON[item.id];
              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                    <Link href={href}>
                      <Icon weight={active ? 'fill' : 'regular'} />
                      <span className="truncate">{item.label}</span>
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
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/book' || pathname.startsWith('/book/')}
              tooltip="교재"
            >
              <Link href="/book">
                <BookOpenTextIcon />
                <span>교재</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
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

function keepSectionOnThemeChange(nextTheme: ThemeId, section: ThemeSectionId | null): string {
  if (!section) return themeHref(nextTheme);
  return sectionHref(nextTheme, section);
}
