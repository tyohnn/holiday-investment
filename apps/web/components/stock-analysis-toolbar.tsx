'use client';

import { usePathname } from 'next/navigation';
import { CaretDownIcon, CaretRightIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { BOARDS } from '@/lib/analysis';
import { COMPANY_MENUS } from '@/lib/company';
import {
  ANALYSIS_AREAS,
  analysisAreaHref,
  analysisHref,
  parseAppPath,
  type AnalysisAreaId,
} from '@/lib/nav';
import { Button } from '@/components/ui/button';
import { PathCombobox } from '@/components/path-combobox';
import { useSymbolCommand } from '@/components/symbol-command';

export function StockAnalysisToolbar({ stockCode }: { stockCode: string }) {
  const pathname = usePathname();
  const { companies, openSearch } = useSymbolCommand();
  const company = companies.find((item) => item.stock_code === stockCode);
  const { menuSlug, boardSlug, analysisArea } = parseAppPath(pathname);
  const area: AnalysisAreaId = analysisArea ?? (boardSlug ? 'lab' : 'guide');
  const pageValue = boardSlug ?? menuSlug ?? COMPANY_MENUS[0].slug;

  const pageGroups =
    area === 'lab'
      ? [
          {
            heading: '분석 순서',
            items: BOARDS.map((board) => ({
              value: board.slug,
              label: `${board.step}. ${board.title}`,
              href: analysisHref(stockCode, board.slug),
              hint: board.question,
            })),
          },
        ]
      : [
          {
            heading: '기업정보',
            items: COMPANY_MENUS.map((menu) => ({
              value: menu.slug,
              label: menu.title,
              href: analysisHref(stockCode, menu.slug),
            })),
          },
        ];

  const currentBoard = BOARDS.find((board) => board.slug === pageValue);
  const currentPageLabel =
    area === 'lab'
      ? (currentBoard ? `${currentBoard.step}. ${currentBoard.title}` : '분석 순서')
      : (COMPANY_MENUS.find((menu) => menu.slug === pageValue)?.title ?? '기업정보');

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-background px-3 py-1.5 sm:px-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 max-w-[16rem] gap-2 px-2"
        onClick={() => openSearch()}
      >
        {company ? (
          <>
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
              {company.name.slice(0, 1)}
            </span>
            <span className="truncate text-sm font-semibold">{company.name}</span>
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
              {company.stock_code}
            </span>
          </>
        ) : (
          <>
            <MagnifyingGlassIcon className="size-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">종목 선택</span>
          </>
        )}
        <CaretDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </Button>

      <CaretRightIcon className="size-3 shrink-0 text-border" />

      <PathCombobox
        value={area}
        label={ANALYSIS_AREAS.find((item) => item.id === area)?.label ?? '영역'}
        placeholder="기업정보 / 분석 순서"
        groups={[
          {
            items: ANALYSIS_AREAS.map((item) => ({
              value: item.id,
              label: item.label,
              href: analysisAreaHref(stockCode, item.id),
            })),
          },
        ]}
      />

      <CaretRightIcon className="size-3 shrink-0 text-border" />

      <PathCombobox
        value={pageValue}
        label={currentPageLabel}
        placeholder={area === 'lab' ? '분석 단계' : '기업정보 메뉴'}
        groups={pageGroups}
      />
    </div>
  );
}
