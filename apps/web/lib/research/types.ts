export type ResearchWidgetKind = 'chart' | 'news' | 'note' | 'metric' | 'link';

export type ResearchWidgetLayout = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

export type ResearchWidget = {
  id: string;
  kind: ResearchWidgetKind;
  title: string;
  layout: ResearchWidgetLayout;
  body?: string;
  source?: string;
  href?: string;
  hrefLabel?: string;
  items?: { title: string; href?: string; note?: string }[];
  metric?: { value: string; caption: string };
};

export type ResearchGroup = {
  id: string;
  title: string;
  summary: string;
  /** 보드(바깥 RGL) 안에서의 이 그룹 칸 */
  layout: ResearchWidgetLayout;
  widgets: ResearchWidget[];
};

export type ResearchBoard = {
  slug: string;
  title: string;
  tagline: string;
  theme: 'stocks';
  relatedStockCode?: string;
  relatedIndustrySlug?: string;
  groups: ResearchGroup[];
};
