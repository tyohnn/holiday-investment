// Barrel re-export for the 30 chartcn components installed under
// `components/charts/`. Each component is the chartcn-registry file with
// its hardcoded demo data/config lifted to optional props (defaults keep
// the demo values) and its `Card` wrapper removed — see the per-family
// prop signatures in each file for what's configurable.

export { ChartBarBasic } from './bar-basic';
export { ChartBarDualAxis } from './bar-dual-axis';
export { ChartBarGrouped } from './bar-grouped';
export { ChartBarReference } from './bar-reference';
export { ChartBarStacked } from './bar-stacked';
export { ChartBarStackedExpand } from './bar-stacked-expand';

export { ChartLineBasic } from './line-basic';
export { ChartLineDots } from './line-dots';
export { ChartLineDualAxis } from './line-dual-axis';
export { ChartLineMulti } from './line-multi';

export { ChartBarDiverging } from './extras/bar-diverging';
export { ChartBarHorizontal } from './extras/bar-horizontal';
export { ChartBarRange } from './extras/bar-range';
export { ChartFunnelTemplate } from './extras/funnel-template';
export { ChartLineReference } from './extras/line-reference';

export { ChartPieBasic } from './pie-basic';
export { ChartPieDonut } from './pie-donut';

export { ChartRadarMulti } from './radar-multi';

export { ChartTreemapBasic } from './treemap-basic';
export { ChartTreemapGrouped } from './treemap-grouped';

export { ChartScatterBasic } from './scatter-basic';
export { ChartScatterBubble } from './scatter-bubble';
export { ChartScatterTrend } from './scatter-trend';

export { ChartBullet } from './analysis/bullet';
export { ChartHeatmapCorrelation } from './analysis/heatmap-correlation';
export { ChartSlope } from './analysis/slope';
export { ChartWaterfall } from './analysis/waterfall';

export { ChartRadialGauge } from './radial-gauge';
export { ChartRadialProgress } from './radial-progress';

export { ChartSankeyBasic } from './sankey-basic';
