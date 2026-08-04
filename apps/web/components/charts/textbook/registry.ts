import type { TextbookChartSpec } from './types';

/**
 * id → TextbookChartSpec.
 *
 * This module intentionally starts empty. Chapter authors add charts by
 * creating a module at `data/<book>-<chapter>.tsx` (e.g. `data/book1-c2.tsx`
 * for 1권 C2, `data/book2-e3.tsx` for 2권 E3) that exports one or more
 * `TextbookChartSpec`s and calls `registerTextbookCharts([...])` at module
 * scope, then listing that module in `data/index.ts` for its side effect.
 *
 * Chapter modules are **not** imported from this file — `data/index.ts`
 * imports both this module and every chapter module, one level up. If this
 * file imported chapter modules directly, that would be a circular import
 * (chapter module → `registerTextbookCharts` → this file) and `registry`
 * below would still be in its temporal dead zone when the chapter module's
 * top-level `registerTextbookCharts([...])` call runs, throwing
 * `ReferenceError: Cannot access 'registry' before initialization`.
 *
 * Example chapter module — import the actual chartcn component from
 * `components/charts/*` (e.g. `ChartBarBasic` from `../../bar-basic`, or via
 * the barrel at `components/charts`), and pass it your chapter's real
 * numbers as props. Never invent data that isn't in the chapter body.
 *
 * ```tsx
 * // data/book1-c2.tsx
 * import { ChartBarBasic } from '../../bar-basic';
 * import { registerTextbookCharts } from '../registry';
 *
 * registerTextbookCharts([
 *   {
 *     id: 'book1-c2-scenario-matrix',
 *     title: '아홉 칸 시나리오 매트릭스',
 *     description: '순이익 3케이스 × PER 3케이스',
 *     source: '9장 본문 「이익이 정상으로…」 표',
 *     render: () => (
 *       <ChartBarBasic
 *         data={[{ scenario: '비관', value: 42000 }, ...]}
 *         config={{ value: { label: '적정주가', color: 'var(--chart-1)' } }}
 *         xKey="scenario"
 *         dataKey="value"
 *       />
 *     ),
 *   },
 * ]);
 * ```
 *
 * Then add the module to the list in `data/index.ts`:
 *
 * ```ts
 * import './book1-c2';
 * ```
 */
const registry = new Map<string, TextbookChartSpec>();

export function registerTextbookCharts(specs: TextbookChartSpec[]) {
  for (const spec of specs) {
    if (registry.has(spec.id)) {
      throw new Error(`Duplicate textbook chart id: "${spec.id}"`);
    }
    registry.set(spec.id, spec);
  }
}

export function getTextbookChart(id: string): TextbookChartSpec | undefined {
  return registry.get(id);
}
