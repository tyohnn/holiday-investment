import type { CompanyMenuId } from './catalog';

export type GuideLevel = 0 | 1 | 2;
export type GuideUnit = 'won' | 'pct' | 'text' | 'shares' | 'count' | 'price';

/** fin_periods 컬럼과 1:1. db.ts FinPeriodConcept 와 같게 유지한다. */
export const GUIDE_CONCEPTS = [
  'revenue',
  'cogs',
  'gross_profit',
  'sga',
  'operating_income',
  'net_income',
  'depreciation',
  'amortisation',
  'ebitda',
  'cf_operating',
  'cf_investing',
  'cf_financing',
  'assets',
  'liabilities',
  'equity',
  'cash',
  'st_borrowings',
  'current_lt_borrowings',
  'lt_borrowings',
  'bonds',
  'current_bonds',
  'borrowings_total',
  'net_debt',
  'gpm_pct',
  'opm_pct',
  'npm_pct',
  'roe_pct',
  'debt_ratio_pct',
] as const;
export type GuideConcept = (typeof GUIDE_CONCEPTS)[number];

/** fin_periods 개념, 파생값, 회사 필드. 목록에 없으면 공칸. */
export type GuideBindKey =
  | GuideConcept
  | 'yoy:revenue'
  | 'yoy:operating_income'
  | 'yoy:net_income'
  | 'yoy:sga'
  | 'yoy:ebitda'
  | 'equity_ratio'
  | 'net_debt_ratio'
  | 'company.name'
  | 'company.ceo'
  | 'company.established'
  | 'company.fiscal_month'
  | 'company.market'
  | 'company.stock_code'
  | 'company.sector'
  | 'company.corp_code';

export type GuideColumnPreset =
  | 'fin-is'
  | 'fin-bs'
  | 'highlight'
  | 'ratio-a'
  | 'ratio-q'
  | 'invest'
  | 'invest-price'
  | 'cons-actual'
  | 'cons-ts'
  | 'sector'
  | 'snap-sector'
  | 'peers'
  | 'staff';

export type GuideRowDef = {
  id: string;
  label: string;
  level: GuideLevel;
  bind?: GuideBindKey;
  unit?: GuideUnit;
  formula?: string;
  children?: GuideRowDef[];
};

export type GuideKvItem = {
  id: string;
  label: string;
  bind?: GuideBindKey;
  unit?: GuideUnit;
};

export type GuideTableColumn = { id: string; label: string };

export type GuideRecordSource = 'ownership' | 'events' | 'filings' | 'empty';

export type GuideSectionDef =
  | { kind: 'kpis'; id: string; title: string; items: GuideKvItem[] }
  | { kind: 'kv'; id: string; title: string; items: GuideKvItem[] }
  | { kind: 'chart'; id: string; title: string; series: string[]; filled?: 'financial' }
  | {
      kind: 'tree-table';
      id: string;
      title: string;
      columns: GuideColumnPreset;
      rows: GuideRowDef[];
      note?: string;
    }
  | {
      kind: 'records';
      id: string;
      title: string;
      columns: GuideTableColumn[];
      source: GuideRecordSource;
      emptyRows?: number;
      note?: string;
    }
  | {
      kind: 'tabs';
      id: string;
      title?: string;
      tabs: { id: string; label: string; sections: GuideSectionDef[] }[];
    }
  | { kind: 'iframe'; id: string; title: string; srcTemplate: string }
  | { kind: 'note'; id: string; title?: string; text: string };

export type GuidePageDef = {
  id: CompanyMenuId;
  title: string;
  sections: GuideSectionDef[];
};

export function row(
  id: string,
  label: string,
  level: GuideLevel,
  bind?: GuideBindKey,
  children?: GuideRowDef[],
  extra?: { unit?: GuideUnit; formula?: string },
): GuideRowDef {
  return {
    id,
    label,
    level,
    bind,
    unit: extra?.unit,
    formula: extra?.formula,
    children,
  };
}

export const r0 = (
  id: string,
  label: string,
  bind?: GuideBindKey,
  children?: GuideRowDef[],
  extra?: { unit?: GuideUnit; formula?: string },
) => row(id, label, 0, bind, children, extra);

export const r1 = (
  id: string,
  label: string,
  bind?: GuideBindKey,
  children?: GuideRowDef[],
  extra?: { unit?: GuideUnit; formula?: string },
) => row(id, label, 1, bind, children, extra);

export const r2 = (
  id: string,
  label: string,
  bind?: GuideBindKey,
  extra?: { unit?: GuideUnit; formula?: string },
) => row(id, label, 2, bind, undefined, extra);

export function kv(id: string, label: string, bind?: GuideBindKey, unit?: GuideUnit): GuideKvItem {
  return { id, label, bind, unit };
}

export const SHAREHOLDER_GROUPS = [
  { id: 'largest', label: '최대주주등 (본인+특별관계자)' },
  { id: 'over10', label: '10%이상주주 (본인+특별관계자)' },
  { id: 'over5', label: '5%이상주주 (본인+특별관계자)' },
  { id: 'officers', label: '임원 (5%미만 중, 임원인자)' },
  { id: 'treasury', label: '자사주(자사주+자사주신탁)' },
  { id: 'esop', label: '우리사주조합' },
] as const;

export function walkRows(rows: GuideRowDef[], visit: (row: GuideRowDef) => void): void {
  for (const item of rows) {
    visit(item);
    if (item.children?.length) walkRows(item.children, visit);
  }
}

export function countRows(rows: GuideRowDef[]): number {
  let n = 0;
  walkRows(rows, () => {
    n += 1;
  });
  return n;
}
