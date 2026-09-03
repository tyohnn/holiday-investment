export type ResearchWidgetKind = 'chart' | 'news' | 'note' | 'metric' | 'link';

/** 그룹 안 카드 배치 실험. 보드에 persist 하지 않는다. */
export type ResearchInnerMode = 'rgl' | 'plain';

export type ResearchWidgetLayout = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxH?: number;
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
  /** 레거시 바깥 RGL 칸. Flow 월드 좌표는 배열 순서로 계산한다. */
  layout: ResearchWidgetLayout;
  widgets: ResearchWidget[];
};

export type ResearchBoardTheme = 'stocks' | 'real-estate';

export type ResearchBoard = {
  slug: string;
  title: string;
  tagline: string;
  theme: ResearchBoardTheme;
  relatedStockCode?: string;
  relatedIndustrySlug?: string;
  groups: ResearchGroup[];
};
