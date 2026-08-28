import { COMPANY_MENUS, type CompanyMenuId } from './catalog';
import { countRows, walkRows, type GuideSectionDef } from './guide-model';
import { GUIDE_PAGES } from './guide-pages';

function walkSections(sections: GuideSectionDef[], visit: (section: GuideSectionDef) => void) {
  for (const section of sections) {
    visit(section);
    if (section.kind === 'tabs') {
      for (const tab of section.tabs) walkSections(tab.sections, visit);
    }
  }
}

export function inventoryGuidePages(): Record<
  CompanyMenuId,
  { sections: number; treeRows: number; kvItems: number; recordSlots: number }
> {
  const out = {} as Record<
    CompanyMenuId,
    { sections: number; treeRows: number; kvItems: number; recordSlots: number }
  >;
  for (const menu of COMPANY_MENUS) {
    let sections = 0;
    let treeRows = 0;
    let kvItems = 0;
    let recordSlots = 0;
    walkSections(GUIDE_PAGES[menu.id].sections, (section) => {
      sections += 1;
      if (section.kind === 'tree-table') treeRows += countRows(section.rows);
      if (section.kind === 'kv' || section.kind === 'kpis') kvItems += section.items.length;
      if (section.kind === 'records') {
        recordSlots += section.columns.length * (section.emptyRows ?? 0);
      }
      if (section.kind === 'tree-table') {
        walkRows(section.rows, () => undefined);
      }
    });
    out[menu.id] = { sections, treeRows, kvItems, recordSlots };
  }
  return out;
}

export { GUIDE_PAGES, getGuidePage } from './guide-pages';
export { SHAREHOLDER_GROUPS, countRows, walkRows } from './guide-model';
