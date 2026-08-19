/** 제품 스토리 지도 — 장면(scene) 단위. 한 장면은 웹페이지처럼 세로 스크롤만 한다. */

export type GrowthKind = 'yoy' | 'units' | 'share' | 'qualitative';

export type GrowthFact = {
  label: string;
  /** 표시 문자열. 숫자만 있는 값은 value + unit 으로 조합하지 않고 그대로 쓴다. */
  value: string;
  kind: GrowthKind;
  /** filing | ir | news | estimate */
  source: string;
  href?: string;
};

export type StoryNews = {
  title: string;
  date?: string;
  href: string;
  note?: string;
};

export type StoryProduct = {
  id: string;
  name: string;
  role: string;
  /** 히트작 여부 */
  hit?: boolean;
  growth: GrowthFact[];
  news: StoryNews[];
};

export type StoryLine = {
  id: string;
  name: string;
  brief: string;
  concern: string;
  growth: GrowthFact[];
  products: StoryProduct[];
  news: StoryNews[];
};

export type StoryMixRow = {
  label: string;
  amount: string;
  yoy?: string;
  share?: string;
  note?: string;
};

export type ProductStory = {
  stockCode: string;
  brand: string;
  asOf: string;
  thesis: string;
  mix: { title: string; rows: StoryMixRow[]; source: string; href?: string }[];
  lines: StoryLine[];
  sources: { label: string; href: string }[];
};
