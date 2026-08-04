import type { ReactNode } from 'react';

/**
 * One entry in the textbook chart registry.
 *
 * `render` returns the chart body only (a parametrized chartcn component
 * from `components/charts/*`, e.g. `ChartBarBasic`) — the surrounding
 * `Card` (title / description / source caption) is owned by
 * `<TextbookChart />`, not by chapter data modules.
 */
export type TextbookChartSpec = {
  /** Stable id, matches the `id="…"` on the `<!-- MEDIA:chart --> ` marker. */
  id: string;
  /** Chart title — rendered as `CardTitle`. */
  title: string;
  /** Optional subtitle — rendered as `CardDescription`. */
  description?: string;
  /**
   * Source caption — which part of the chapter body the numbers came from
   * (e.g. "17장 본문 「종목 수와 전체 흔들림」 표"). Rendered in small type
   * under the chart. Every chart must cite real chapter text; never invent
   * numbers for this field or the chart data itself.
   */
  source: string;
  /** Chart body only — no Card wrapper. */
  render: () => ReactNode;
};
