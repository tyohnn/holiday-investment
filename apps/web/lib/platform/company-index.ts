import { classifySector } from '@investment/schema';
import { getBoardBySlug, LEGACY_BOARD_SLUGS } from '@/lib/analysis';

/** Command·홈 목록이 쓰는 가벼운 종목 행. profile jsonb 는 가져오지 않는다. */
export type CompanyIndex = {
  stock_code: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ' | 'KONEX' | null;
  sector_code: string | null;
};

export type IndustryIndex = {
  slug: string;
  name: string;
  tagline: string;
};

export type ChapterIndex = {
  href: string;
  title: string;
  heading: string;
  bookLabel: string;
};

export type MarketChip = 'all' | 'KOSPI' | 'KOSDAQ' | 'recent';

export function companyIndustryName(company: CompanyIndex): string {
  return classifySector(company.sector_code, company.stock_code)?.industryName ?? '업종 미상';
}

export function companyMetaLine(company: CompanyIndex): string {
  return [company.market, companyIndustryName(company)].filter(Boolean).join(' · ');
}

export function parseLabPath(pathname: string): { stockCode: string | null; boardSlug: string } {
  const match = pathname.match(/^\/lab\/([^/]+)(?:\/([^/]+))?/);
  if (!match) return { stockCode: null, boardSlug: 'verdict' };
  const raw = match[2];
  const mapped = raw ? (LEGACY_BOARD_SLUGS[raw] ?? raw) : 'verdict';
  return {
    stockCode: match[1] ?? null,
    boardSlug: getBoardBySlug(mapped) ? mapped : 'verdict',
  };
}

export function labHref(stockCode: string, boardSlug = 'verdict'): string {
  return `/lab/${stockCode}/${boardSlug}`;
}

export function matchesCompany(company: CompanyIndex, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [company.name, company.stock_code, company.market ?? '', companyIndustryName(company)]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function matchesIndustry(industry: IndustryIndex, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${industry.name} ${industry.tagline} ${industry.slug}`.toLowerCase().includes(q);
}

export function matchesChapter(chapter: ChapterIndex, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${chapter.title} ${chapter.heading} ${chapter.bookLabel}`.toLowerCase().includes(q);
}
