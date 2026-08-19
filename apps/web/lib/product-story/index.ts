import type { Company } from '@investment/schema';
import { APR_PRODUCT_STORY } from './apr';
import type { ProductStory } from './types';

export type { ProductStory, StoryLine, StoryProduct } from './types';

export function getProductStory(stockCode: string): ProductStory | null {
  if (stockCode === APR_PRODUCT_STORY.stockCode) return APR_PRODUCT_STORY;
  return null;
}

/** 로컬 시드에 없는 종목이어도 제품 지도를 열 수 있게 하는 최소 회사 행. */
export function stubCompanyForStory(story: ProductStory): Company {
  return {
    corp_code: 'story',
    name: story.brand,
    stock_code: story.stockCode,
    market: 'KOSPI',
    sector_code: null,
    fiscal_month: 12,
    ceo: null,
    established: null,
  };
}
