/**
 * 앱 셸 IA 정본 — 사이드바·브레드크럼·href 는 이 파일만 읽는다.
 *
 * 레이어 (위가 더 넓다)
 *   1. 테마        주식 | 부동산
 *   2. 섹션        종목 분석 | 거시경제 분석 | 전체 뉴스 | 리서치 보드
 *   3. 종목 분석   종목 selector + (기업정보 | 분석 순서) + 페이지 combobox
 *
 * 라우트
 *   /{theme}                                          테마 홈
 *   /{theme}/analysis                                 종목 분석 목록
 *   /{theme}/analysis/{code}                          Snapshot (기업정보 기본)
 *   /{theme}/analysis/{code}/{section}                기업정보 메뉴 또는 8단계 보드
 *   /{theme}/analysis/{code}/filing/{rcept}/{sec}     공시 섹션
 *   /{theme}/macro                                    거시경제 분석
 *   /{theme}/macro/industries                         산업 지도 (주식)
 *   /{theme}/macro/industries/{slug}                  산업 상세
 *   /{theme}/news                                     전체 뉴스
 *   /{theme}/boards                                   리서치 보드 목록
 *   /{theme}/boards/{boardSlug}                       보드 (주제 그룹 × RGL)
 *
 * 옛 URL 은 next.config.mjs 가 301 한다.
 *   /company/** → /stocks/analysis/**
 *   /lab/:code/:board → /stocks/analysis/:code/:board
 *   /industry/** → /stocks/macro/industries/**
 */

import { BOARDS, getBoardBySlug, LEGACY_BOARD_SLUGS } from '@/lib/analysis';
import { DEFAULT_COMPANY_MENU_SLUG, getCompanyMenuBySlug } from '@/lib/company';

export type ThemeId = 'stocks' | 'real-estate';
export type ThemeSectionId = 'analysis' | 'macro' | 'news' | 'boards';
export type AnalysisAreaId = 'guide' | 'lab';

export type ThemeMeta = {
  id: ThemeId;
  slug: ThemeId;
  label: string;
  description: string;
};

export type ThemeSectionMeta = {
  id: ThemeSectionId;
  slug: ThemeSectionId;
  label: string;
  description: string;
};

export type AnalysisAreaMeta = {
  id: AnalysisAreaId;
  label: string;
};

export const THEMES: ThemeMeta[] = [
  { id: 'stocks', slug: 'stocks', label: '주식', description: '상장 종목·산업·매크로' },
  { id: 'real-estate', slug: 'real-estate', label: '부동산', description: '부동산 테마 — 준비 중' },
];

export const THEME_SECTIONS: ThemeSectionMeta[] = [
  { id: 'analysis', slug: 'analysis', label: '종목 분석', description: '기업정보와 8단계 논증' },
  { id: 'macro', slug: 'macro', label: '거시경제 분석', description: '산업 지도와 매크로 국면' },
  { id: 'news', slug: 'news', label: '전체 뉴스', description: '테마 전체 뉴스 피드' },
  { id: 'boards', slug: 'boards', label: '리서치 보드', description: '주제 그룹으로 묶은 차트·뉴스' },
];

export const ANALYSIS_AREAS: AnalysisAreaMeta[] = [
  { id: 'guide', label: '기업정보' },
  { id: 'lab', label: '분석 순서' },
];

export const DEFAULT_THEME: ThemeId = 'stocks';
export const DEFAULT_SECTION: ThemeSectionId = 'analysis';
export const DEFAULT_ANALYSIS_AREA: AnalysisAreaId = 'guide';

export function getTheme(id: ThemeId): ThemeMeta {
  const theme = THEMES.find((item) => item.id === id);
  if (!theme) throw new Error(`Unknown theme: ${id}`);
  return theme;
}

export function getThemeBySlug(slug: string): ThemeMeta | undefined {
  return THEMES.find((item) => item.slug === slug);
}

export function getThemeSection(id: ThemeSectionId): ThemeSectionMeta {
  const section = THEME_SECTIONS.find((item) => item.id === id);
  if (!section) throw new Error(`Unknown theme section: ${id}`);
  return section;
}

export function getAnalysisArea(id: AnalysisAreaId): AnalysisAreaMeta {
  const area = ANALYSIS_AREAS.find((item) => item.id === id);
  if (!area) throw new Error(`Unknown analysis area: ${id}`);
  return area;
}

export function themeHref(theme: ThemeId = DEFAULT_THEME): string {
  return `/${theme}`;
}

export function sectionHref(theme: ThemeId, section: ThemeSectionId): string {
  return `/${theme}/${section}`;
}

export function analysisHref(stockCode: string, section = DEFAULT_COMPANY_MENU_SLUG): string {
  const menu = getCompanyMenuBySlug(section);
  const board = getBoardBySlug(section);
  const resolved = menu?.slug ?? board?.slug ?? DEFAULT_COMPANY_MENU_SLUG;
  if (resolved === DEFAULT_COMPANY_MENU_SLUG) return `/stocks/analysis/${stockCode}`;
  return `/stocks/analysis/${stockCode}/${resolved}`;
}

export function analysisListHref(theme: ThemeId = DEFAULT_THEME): string {
  return `/${theme}/analysis`;
}

export function analysisAreaHref(stockCode: string, area: AnalysisAreaId): string {
  if (area === 'lab') return analysisHref(stockCode, BOARDS[0]?.slug ?? 'verdict');
  return analysisHref(stockCode, DEFAULT_COMPANY_MENU_SLUG);
}

export function filingHref(stockCode: string, rceptNo: string, secNo: number | string): string {
  return `/stocks/analysis/${stockCode}/filing/${rceptNo}/${secNo}`;
}

export function industryMapHref(): string {
  return '/stocks/macro/industries';
}

export function industryHref(slug: string): string {
  return `/stocks/macro/industries/${encodeURIComponent(slug)}`;
}

export function researchBoardsHref(theme: ThemeId = DEFAULT_THEME): string {
  return `/${theme}/boards`;
}

export function researchBoardHref(boardSlug: string, theme: ThemeId = DEFAULT_THEME): string {
  return `/${theme}/boards/${boardSlug}`;
}

export type AppPath = {
  theme: ThemeId;
  section: ThemeSectionId | null;
  stockCode: string | null;
  menuSlug: string | null;
  boardSlug: string | null;
  analysisArea: AnalysisAreaId | null;
  industrySlug: string | null;
  researchBoardSlug: string | null;
};

const EMPTY_PATH: AppPath = {
  theme: DEFAULT_THEME,
  section: null,
  stockCode: null,
  menuSlug: null,
  boardSlug: null,
  analysisArea: null,
  industrySlug: null,
  researchBoardSlug: null,
};

function resolveSectionSlug(raw: string | undefined): {
  menuSlug: string | null;
  boardSlug: string | null;
  analysisArea: AnalysisAreaId | null;
} {
  if (!raw) {
    return { menuSlug: DEFAULT_COMPANY_MENU_SLUG, boardSlug: null, analysisArea: 'guide' };
  }
  if (raw === 'filing') {
    return { menuSlug: null, boardSlug: 'primary', analysisArea: 'lab' };
  }
  const mapped = LEGACY_BOARD_SLUGS[raw] ?? raw;
  if (getCompanyMenuBySlug(mapped)) {
    return { menuSlug: mapped, boardSlug: null, analysisArea: 'guide' };
  }
  if (getBoardBySlug(mapped)) {
    return { menuSlug: null, boardSlug: mapped, analysisArea: 'lab' };
  }
  return { menuSlug: DEFAULT_COMPANY_MENU_SLUG, boardSlug: null, analysisArea: 'guide' };
}

export function parseAppPath(pathname: string): AppPath {
  const stocks = pathname.match(
    /^\/stocks(?:\/(analysis|macro|news|boards)(?:\/([^/]+)(?:\/([^/]+))?)?)?/,
  );
  if (pathname === '/' || pathname.startsWith('/stocks')) {
    const base: AppPath = {
      ...EMPTY_PATH,
      theme: 'stocks',
      section: (stocks?.[1] as ThemeSectionId | undefined) ?? null,
    };
    if (base.section === 'analysis') {
      const stockCode = /^\d{6}$/.test(stocks?.[2] ?? '') ? (stocks?.[2] ?? null) : null;
      const resolved = resolveSectionSlug(stockCode ? stocks?.[3] : undefined);
      return { ...base, stockCode, ...resolved };
    }
    if (base.section === 'macro' && stocks?.[2] === 'industries') {
      return { ...base, industrySlug: stocks[3] ? decodeURIComponent(stocks[3]) : null };
    }
    if (base.section === 'boards') {
      return { ...base, researchBoardSlug: stocks?.[2] ?? null };
    }
    return base;
  }

  const realEstate = pathname.match(/^\/real-estate(?:\/(analysis|macro|news|boards)(?:\/([^/]+))?)?/);
  if (realEstate) {
    return {
      ...EMPTY_PATH,
      theme: 'real-estate',
      section: (realEstate[1] as ThemeSectionId | undefined) ?? null,
      researchBoardSlug: realEstate[1] === 'boards' ? (realEstate[2] ?? null) : null,
    };
  }

  const company = pathname.match(/^\/company\/(\d{6})(?:\/([^/]+))?/);
  if (company) {
    const resolved = resolveSectionSlug(company[2]);
    return {
      ...EMPTY_PATH,
      theme: 'stocks',
      section: 'analysis',
      stockCode: company[1],
      ...resolved,
    };
  }
  if (pathname === '/company') {
    return { ...EMPTY_PATH, theme: 'stocks', section: 'analysis' };
  }

  const lab = pathname.match(/^\/lab\/([^/]+)(?:\/([^/]+))?/);
  if (lab) {
    const resolved = resolveSectionSlug(lab[2] ?? 'verdict');
    return {
      ...EMPTY_PATH,
      theme: 'stocks',
      section: 'analysis',
      stockCode: lab[1] ?? null,
      ...resolved,
    };
  }

  if (pathname === '/industry' || pathname.startsWith('/industry/')) {
    const slug = pathname.startsWith('/industry/')
      ? decodeURIComponent(pathname.slice('/industry/'.length).split('/')[0] ?? '')
      : null;
    return {
      ...EMPTY_PATH,
      theme: 'stocks',
      section: 'macro',
      industrySlug: slug || null,
    };
  }

  return EMPTY_PATH;
}

export function parseStockPath(pathname: string): {
  stockCode: string | null;
  menuSlug: string | null;
  boardSlug: string | null;
} {
  const parsed = parseAppPath(pathname);
  return {
    stockCode: parsed.stockCode,
    menuSlug: parsed.menuSlug,
    boardSlug: parsed.boardSlug,
  };
}
