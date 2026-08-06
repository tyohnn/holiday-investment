/** 종목 분석 IA — 분석 화면 / 위젯 메타 타입. 레이아웃은 catalog 상수로만 정의한다. */

export type TrustLevel = 'filing' | 'ir' | 'news' | 'estimate' | 'secondary';

export type BoardSection = 'company' | 'industry' | 'agent';

export type BoardId =
  | 'revenue'
  | 'numbers'
  | 'people'
  | 'financials'
  | 'industry'
  | 'study'
  | 'agent';

export type WidgetId =
  // 매출 변화
  | 'market-share-frame'
  | 'capa-to-revenue'
  | 'order-contract-signal'
  | 'capex-execution'
  | 'news-yt-facts'
  | 'cf-investing-notes'
  // 숫자로 보기
  | 'key-four-metrics'
  | 'margin-three-layers'
  | 'resource-allocation'
  | 'org-people-decision'
  | 'segment-mix'
  // 구성원 변화
  | 'major-shareholder'
  | 'dilution-funding'
  | 'treasury-return'
  | 'ma-org'
  | 'management-talent'
  | 'people-profile'
  // 산업
  | 'value-chain-map'
  | 'scorecard'
  | 'phase-three-qs'
  | 'bullwhip-cycle'
  // 기술 / AI
  | 'study-links'
  | 'agent-chat';

export interface TextbookLink {
  label: string;
  /** 교재 경로, 예: /book/book1/C3 */
  href: string;
}

export interface AnalysisWidgetMeta {
  id: WidgetId;
  title: string;
  /** 이 위젯이 답하려는 질문 또는 기본 주장 골격 */
  claim: string;
  question?: string;
  trust: TrustLevel;
  textbooks: TextbookLink[];
  /** tracking topic 필터 (DB 연결용) */
  trackingTopics?: string[];
}

export interface AnalysisBoardMeta {
  id: BoardId;
  section: BoardSection;
  title: string;
  description: string;
  /** URL segment under /company/[stockCode]/ */
  slug: string;
  /** 원천 화면이면 위젯 그리드 대신 기존 섹션 나열 */
  kind: 'widgets' | 'source' | 'hub' | 'agent';
  widgets: WidgetId[];
}

export const TRUST_LABELS: Record<TrustLevel, string> = {
  filing: '공시 확정',
  ir: 'IR',
  news: '뉴스·유튜브',
  estimate: '추정',
  secondary: '2차 자료',
};
