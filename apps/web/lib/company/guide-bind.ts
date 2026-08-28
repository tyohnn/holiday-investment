import {
  OWNERSHIP_KIND_LABELS,
  classifySector,
  formatCount,
  formatPercent,
  formatWon,
  readOwnership,
  type Company,
} from '@investment/schema';
import type { CompanyPageData, GuideFinPeriod, GuideFinValues } from '@/lib/platform/db';
import { SHAREHOLDER_GROUPS, type GuideBindKey, type GuideColumnPreset, type GuideRowDef, type GuideSectionDef, type GuideUnit } from './guide-model';
import { GUIDE_CONCEPTS, type GuideConcept } from './guide-model';
import { getGuidePage } from './guide-pages';
import type { CompanyMenuId } from './catalog';
import type { BoundCell, BoundKv, BoundRow, BoundSection } from './guide-bound';

export type { BoundCell, BoundKv, BoundRow, BoundSection } from './guide-bound';

type ColKind = 'year' | 'quarter' | 'yoy-q' | 'slot' | 'peer-self' | 'peer-other';

type ResolvedCol = {
  id: string;
  label: string;
  kind: ColKind;
  year?: number | null;
  quarter?: GuideFinPeriod | null;
};

function emptyCell(): BoundCell {
  return { text: '—', empty: true };
}

function cellFrom(text: string | null | undefined): BoundCell {
  if (text === null || text === undefined || text === '' || text === '—') return emptyCell();
  return { text, empty: false };
}

function yoy(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr === null || curr === undefined || prev === null || prev === undefined || prev === 0) return null;
  return ((curr / prev) - 1) * 100;
}

function num(values: GuideFinValues | undefined, key: GuideConcept): number | null {
  const v = values?.[key];
  return v === null || v === undefined || !Number.isFinite(v) ? null : v;
}

function formatValue(value: number | null, unit: GuideUnit | undefined): string {
  if (value === null) return '—';
  switch (unit) {
    case 'pct':
      return formatPercent(value);
    case 'shares':
      return formatCount(value, '주');
    case 'count':
      return formatCount(value);
    case 'price':
    case 'won':
    default:
      return formatWon(value);
  }
}

function isConcept(key: GuideBindKey): key is GuideConcept {
  return (GUIDE_CONCEPTS as readonly string[]).includes(key);
}

function fiscalLabel(year: number, month: number | null): string {
  return `${year}/${String(month ?? 12).padStart(2, '0')}`;
}

function takeYears(annual: GuideFinPeriod[], n: number): (number | null)[] {
  const desc = [...annual].sort((a, b) => b.year - a.year).map((row) => row.year);
  const out: (number | null)[] = desc.slice(0, n);
  while (out.length < n) out.push(null);
  return out;
}

function takeQuarters(quarters: GuideFinPeriod[], n: number): (GuideFinPeriod | null)[] {
  const desc = [...quarters].sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  const out: (GuideFinPeriod | null)[] = desc.slice(0, n);
  while (out.length < n) out.push(null);
  return out;
}

function priorQuarter(quarters: GuideFinPeriod[], latest: GuideFinPeriod | null): GuideFinPeriod | null {
  if (!latest) return null;
  const m = latest.periodKey.match(/^(\d{4})(Q[1-4])$/);
  if (!m) return null;
  const key = `${Number(m[1]) - 1}${m[2]}`;
  return quarters.find((row) => row.periodKey === key) ?? null;
}

function resolveColumns(
  preset: GuideColumnPreset,
  ctx: BindCtx,
): ResolvedCol[] {
  const month = ctx.company.fiscal_month;
  const years3 = takeYears(ctx.annual, 3);
  const years4 = takeYears(ctx.annual, 4);
  const years5 = takeYears(ctx.annual, 5);
  const latestQ = takeQuarters(ctx.quarters, 1)[0];
  const priorQ = priorQuarter(ctx.quarters, latestQ);
  const q5 = takeQuarters(ctx.quarters, 5);

  const yearCol = (id: string, year: number | null, fallback: string): ResolvedCol => ({
    id,
    label: year === null ? fallback : fiscalLabel(year, month),
    kind: 'year',
    year,
  });

  switch (preset) {
    case 'fin-is':
      return [
        yearCol('y0', years3[0], '연간'),
        yearCol('y1', years3[1], '연간-1'),
        yearCol('y2', years3[2], '연간-2'),
        { id: 'q', label: latestQ?.periodKey ?? '최근분기', kind: 'quarter', quarter: latestQ },
        { id: 'pq', label: priorQ?.periodKey ?? '전년동기', kind: 'quarter', quarter: priorQ },
        { id: 'yoy', label: '전년동기대비(%)', kind: 'yoy-q', quarter: latestQ },
      ];
    case 'fin-bs':
    case 'highlight':
      return [
        yearCol('y0', years3[0], '연간'),
        yearCol('y1', years3[1], '연간-1'),
        yearCol('y2', years3[2], '연간-2'),
        { id: 'q', label: latestQ?.periodKey ?? '최근분기', kind: 'quarter', quarter: latestQ },
      ];
    case 'ratio-a':
    case 'invest':
      return [
        yearCol('y0', years4[0], '연간'),
        yearCol('y1', years4[1], '연간-1'),
        yearCol('y2', years4[2], '연간-2'),
        yearCol('y3', years4[3], '연간-3'),
        { id: 'q', label: latestQ?.periodKey ?? '최근분기', kind: 'quarter', quarter: latestQ },
      ];
    case 'ratio-q':
      return q5.map((row, i) => ({
        id: `q${i}`,
        label: row?.periodKey ?? `분기-${i + 1}`,
        kind: 'quarter' as const,
        quarter: row,
      }));
    case 'cons-actual':
      return [
        { id: 'actual', label: '실적', kind: 'year', year: years3[0] },
        { id: 'cons', label: '컨센서스', kind: 'slot' },
        { id: 'vs', label: '컨센서스대비(%)', kind: 'slot' },
        { id: 'yoy', label: '전년동기대비(%)', kind: 'year', year: years3[0] },
        { id: 'fy0', label: 'FY0E', kind: 'slot' },
        { id: 'fy1', label: 'FY1E', kind: 'slot' },
        { id: 'fy2', label: 'FY2E', kind: 'slot' },
      ];
    case 'cons-ts':
      return [
        { id: 'now', label: '현재', kind: 'year', year: years3[0] },
        { id: 'm1', label: '1개월전', kind: 'slot' },
        { id: 'm3', label: '3개월전', kind: 'slot' },
        { id: 'm6', label: '6개월전', kind: 'slot' },
        { id: 'y1', label: '1년전', kind: 'slot' },
      ];
    case 'sector':
      return years5.map((year, i) => yearCol(`y${i}`, year, `연간-${i}`));
    case 'peers':
      return [
        { id: 'self', label: ctx.company.name, kind: 'peer-self', year: years3[0] },
        { id: 'peer-a', label: 'Peer A', kind: 'peer-other' },
        { id: 'peer-b', label: 'Peer B', kind: 'peer-other' },
        { id: 'peer-c', label: 'Peer C', kind: 'peer-other' },
      ];
    case 'staff':
      return [
        yearCol('y0', years3[0], '연간'),
        yearCol('y1', years3[1], '연간-1'),
        yearCol('y2', years3[2], '연간-2'),
        { id: 'latest', label: '최근', kind: 'slot' },
      ];
  }
}

type BindCtx = {
  company: Company;
  annual: GuideFinPeriod[];
  quarters: GuideFinPeriod[];
  byYear: Map<number, GuideFinPeriod>;
};

function annualByYear(year: number | null | undefined, ctx: BindCtx): GuideFinPeriod | undefined {
  if (year === null || year === undefined) return undefined;
  return ctx.byYear.get(year);
}

function prevYear(year: number | null | undefined): number | null {
  return year === null || year === undefined ? null : year - 1;
}

function readBind(
  bind: GuideBindKey | undefined,
  unit: GuideUnit | undefined,
  col: ResolvedCol,
  ctx: BindCtx,
): BoundCell {
  if (!bind) return emptyCell();
  if (bind.startsWith('company.')) return companyCell(bind, ctx.company);

  if (col.kind === 'slot' || col.kind === 'peer-other') return emptyCell();

  const period =
    col.kind === 'quarter' || col.kind === 'yoy-q'
      ? col.quarter
      : annualByYear(col.year ?? null, ctx);
  const values = period?.values;

  if (bind.startsWith('yoy:')) {
    const concept = bind.slice(4) as GuideConcept;
    if (col.kind === 'yoy-q' || col.id === 'yoy') {
      const latest = col.kind === 'yoy-q' ? col.quarter : takeQuarters(ctx.quarters, 1)[0] ?? period;
      const prior =
        latest && col.kind === 'yoy-q'
          ? priorQuarter(ctx.quarters, latest)
          : annualByYear(prevYear(col.year ?? period?.year ?? null), ctx);
      return cellFrom(formatValue(yoy(num(latest?.values, concept), num(prior?.values, concept)), 'pct'));
    }
    if (col.kind === 'year' || col.kind === 'peer-self') {
      const curr = annualByYear(col.year ?? null, ctx);
      const prior = annualByYear(prevYear(col.year ?? null), ctx);
      return cellFrom(formatValue(yoy(num(curr?.values, concept), num(prior?.values, concept)), 'pct'));
    }
    if (col.kind === 'quarter') {
      const prior = priorQuarter(ctx.quarters, col.quarter ?? null);
      return cellFrom(formatValue(yoy(num(values, concept), num(prior?.values, concept)), 'pct'));
    }
    return emptyCell();
  }

  if (bind === 'equity_ratio') {
    const eq = num(values, 'equity');
    const as = num(values, 'assets');
    if (eq === null || as === null || as === 0) return emptyCell();
    return cellFrom(formatValue((eq / as) * 100, 'pct'));
  }

  if (bind === 'net_debt_ratio') {
    const nd = num(values, 'net_debt');
    const eq = num(values, 'equity');
    if (nd === null || eq === null || eq === 0) return emptyCell();
    return cellFrom(formatValue((nd / eq) * 100, 'pct'));
  }

  if (isConcept(bind)) {
    const unitOverride: GuideUnit | undefined =
      unit ?? (bind.endsWith('_pct') ? 'pct' : 'won');
    if (col.kind === 'yoy-q' || col.id === 'yoy') {
      const latest = col.kind === 'yoy-q' ? col.quarter : period;
      const prior =
        latest && col.kind === 'yoy-q'
          ? priorQuarter(ctx.quarters, latest)
          : annualByYear(prevYear(col.year ?? latest?.year ?? null), ctx);
      return cellFrom(formatValue(yoy(num(latest?.values, bind), num(prior?.values, bind)), 'pct'));
    }
    return cellFrom(formatValue(num(values, bind), unitOverride));
  }

  return emptyCell();
}

function companyCell(bind: string, company: Company): BoundCell {
  switch (bind) {
    case 'company.name':
      return cellFrom(company.name);
    case 'company.ceo':
      return cellFrom(company.ceo);
    case 'company.established':
      return cellFrom(company.established);
    case 'company.fiscal_month':
      return cellFrom(company.fiscal_month != null ? `${company.fiscal_month}월` : null);
    case 'company.market':
      return cellFrom(company.market);
    case 'company.stock_code':
      return cellFrom(company.stock_code);
    case 'company.sector':
      return cellFrom(classifySector(company.sector_code, company.stock_code)?.industryName);
    case 'company.corp_code':
      return cellFrom(company.corp_code);
    default:
      return emptyCell();
  }
}

function bindRow(def: GuideRowDef, cols: ResolvedCol[], ctx: BindCtx): BoundRow {
  return {
    id: def.id,
    label: def.label,
    level: def.level,
    formula: def.formula,
    cells: cols.map((col) => readBind(def.bind, def.unit, col, ctx)),
    children: (def.children ?? []).map((child) => bindRow(child, cols, ctx)),
  };
}

function bindKv(def: { id: string; label: string; bind?: GuideBindKey; unit?: GuideUnit }, ctx: BindCtx): BoundKv {
  if (!def.bind) return { id: def.id, label: def.label, value: '—', empty: true };
  if (def.bind.startsWith('company.')) {
    const c = companyCell(def.bind, ctx.company);
    return { id: def.id, label: def.label, value: c.text, empty: c.empty };
  }
  const latest = [...ctx.annual].sort((a, b) => b.year - a.year)[0];
  const col: ResolvedCol = { id: 'latest', label: 'latest', kind: 'year', year: latest?.year ?? null };
  const c = readBind(def.bind, def.unit, col, ctx);
  return { id: def.id, label: def.label, value: c.text, empty: c.empty };
}

function bindRecords(
  section: Extract<GuideSectionDef, { kind: 'records' }>,
  data: CompanyPageData,
): string[][] {
  if (section.source === 'ownership') {
    return data.ownershipTxns.slice(0, 20).map((txn) => {
      const read = readOwnership(txn);
      return [
        OWNERSHIP_KIND_LABELS[txn.kind],
        read.reporter ?? '—',
        read.reporter ?? '—',
        txn.rcept_dt ?? '—',
        read.note ?? '—',
        '—',
        '—',
        read.sharesDelta !== null ? formatCount(read.sharesDelta) : '—',
        read.shares !== null ? formatCount(read.shares, '주') : '—',
        formatPercent(read.ratio),
      ];
    });
  }
  if (section.source === 'events') {
    return data.events.map((event, i) => [
      String(i + 1),
      event.event_type,
      event.rcept_dt ?? '—',
    ]);
  }
  if (section.source === 'filings') {
    return data.filings.map((filing) => [
      filing.rcept_dt,
      filing.report_nm,
      filing.flr_nm ?? '—',
      filing.is_correction ? '정정' : '—',
    ]);
  }
  if (section.id === 'own-class') {
    return SHAREHOLDER_GROUPS.map((group) => [group.label, '—', '—', '—', '—']);
  }
  const width = section.columns.length;
  const n = section.emptyRows ?? 3;
  return Array.from({ length: n }, () => Array.from({ length: width }, () => '—'));
}

function bindSection(section: GuideSectionDef, data: CompanyPageData, ctx: BindCtx): BoundSection {
  switch (section.kind) {
    case 'kpis':
      return { kind: 'kpis', id: section.id, title: section.title, items: section.items.map((item) => bindKv(item, ctx)) };
    case 'kv':
      return { kind: 'kv', id: section.id, title: section.title, items: section.items.map((item) => bindKv(item, ctx)) };
    case 'chart':
      return { kind: 'chart', id: section.id, title: section.title, series: section.series, filled: section.filled };
    case 'tree-table': {
      const cols = resolveColumns(section.columns, ctx);
      const defs =
        section.columns === 'sector'
          ? section.rows.map((row) => (row.label === '종목' ? { ...row, label: ctx.company.name } : row))
          : section.rows;
      return {
        kind: 'tree-table',
        id: section.id,
        title: section.title,
        columns: cols.map((col) => ({ id: col.id, label: col.label })),
        rows: defs.map((row) => bindRow(row, cols, ctx)),
        note: section.note,
      };
    }
    case 'records':
      return {
        kind: 'records',
        id: section.id,
        title: section.title,
        columns: section.columns,
        rows: bindRecords(section, data),
        note: section.note,
      };
    case 'tabs':
      return {
        kind: 'tabs',
        id: section.id,
        title: section.title,
        tabs: section.tabs.map((tab) => ({
          id: tab.id,
          label: tab.label,
          sections: tab.sections.map((child) => bindSection(child, data, ctx)),
        })),
      };
    case 'iframe':
      return {
        kind: 'iframe',
        id: section.id,
        title: section.title,
        src: section.srcTemplate.replace('{stockCode}', data.company.stock_code ?? ''),
      };
    case 'note':
      return { kind: 'note', id: section.id, title: section.title, text: section.text };
  }
}

export function bindGuidePage(menuId: CompanyMenuId, data: CompanyPageData): BoundSection[] {
  const page = getGuidePage(menuId);
  const annual = data.guideFin.annual;
  const ctx: BindCtx = {
    company: data.company,
    annual,
    quarters: data.guideFin.quarters,
    byYear: new Map(annual.map((row) => [row.year, row])),
  };
  return page.sections.map((section) => bindSection(section, data, ctx));
}

export function countBoundHoles(sections: BoundSection[]): { rows: number; cells: number; empty: number } {
  let rows = 0;
  let cells = 0;
  let empty = 0;
  const walk = (list: BoundSection[]) => {
    for (const section of list) {
      if (section.kind === 'tree-table') {
        const visit = (row: BoundRow) => {
          rows += 1;
          for (const cell of row.cells) {
            cells += 1;
            if (cell.empty) empty += 1;
          }
          row.children.forEach(visit);
        };
        section.rows.forEach(visit);
      } else if (section.kind === 'records') {
        rows += section.rows.length;
        for (const row of section.rows) {
          for (const cell of row) {
            cells += 1;
            if (cell === '—') empty += 1;
          }
        }
      } else if (section.kind === 'kv' || section.kind === 'kpis') {
        rows += section.items.length;
        for (const item of section.items) {
          cells += 1;
          if (item.empty) empty += 1;
        }
      } else if (section.kind === 'tabs') {
        for (const tab of section.tabs) walk(tab.sections);
      }
    }
  };
  walk(sections);
  return { rows, cells, empty };
}
