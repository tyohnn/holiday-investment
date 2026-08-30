export type CompanyMenuId =
  | 'snapshot'
  | 'profile'
  | 'financials'
  | 'ratios'
  | 'indicators'
  | 'consensus'
  | 'ownership'
  | 'sector'
  | 'peers'
  | 'exchange-filings'
  | 'fss-filings';

export type CompanyMenuMeta = {
  id: CompanyMenuId;
  slug: string;
  title: string;
};

/**
 * FnGuide Company Guide 기업정보 서브메뉴 — 이름·순서 정본.
 * https://comp.fnguide.com/SVO2/ASP/SVD_Main.asp (Snapshot … 금감원공시)
 */
export const COMPANY_MENUS: CompanyMenuMeta[] = [
  { id: 'snapshot', slug: 'snapshot', title: 'Snapshot' },
  { id: 'profile', slug: 'profile', title: '기업개요' },
  { id: 'financials', slug: 'financials', title: '재무제표' },
  { id: 'ratios', slug: 'ratios', title: '재무비율' },
  { id: 'indicators', slug: 'indicators', title: '투자지표' },
  { id: 'consensus', slug: 'consensus', title: '컨센서스' },
  { id: 'ownership', slug: 'ownership', title: '지분분석' },
  { id: 'sector', slug: 'sector', title: '업종분석' },
  { id: 'peers', slug: 'peers', title: '경쟁사비교' },
  { id: 'exchange-filings', slug: 'exchange-filings', title: '거래소공시' },
  { id: 'fss-filings', slug: 'fss-filings', title: '금감원공시' },
];

export const DEFAULT_COMPANY_MENU_SLUG = 'snapshot';

export function getCompanyMenu(id: CompanyMenuId): CompanyMenuMeta {
  const menu = COMPANY_MENUS.find((item) => item.id === id);
  if (!menu) throw new Error(`Unknown company menu: ${id}`);
  return menu;
}

export function getCompanyMenuBySlug(slug: string): CompanyMenuMeta | undefined {
  return COMPANY_MENUS.find((item) => item.slug === slug);
}

export function companyHref(stockCode: string, slug = DEFAULT_COMPANY_MENU_SLUG): string {
  const menu = getCompanyMenuBySlug(slug);
  const resolved = menu?.slug ?? DEFAULT_COMPANY_MENU_SLUG;
  if (resolved === DEFAULT_COMPANY_MENU_SLUG) return `/stocks/analysis/${stockCode}`;
  return `/stocks/analysis/${stockCode}/${resolved}`;
}
