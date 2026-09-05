/**
 * 종목 분석 IA — 분석 화면 / 위젯 메타 타입. 레이아웃은 catalog 상수로만 정의한다.
 *
 * IA 는 주제별 서랍이 아니라 **순서 있는 논증**이다. 교재의 의존 그래프
 * (B1 능력범위 → B2 해자 → B3 산업 → C3 매출 → C2 5단계 → A2 진입가)를 그대로 화면
 * 순서로 옮겼고, 리포트 골격(`plugin/skills/company-analysis/references/report-templates.md`)
 * 과 1:1 로 맞춘다 — 에이전트가 쓰는 리포트와 대시보드가 같은 뼈대를 공유해야
 * 한쪽에서 채운 내용이 다른 쪽에서 그대로 읽힌다.
 */

export type TrustLevel = 'filing' | 'ir' | 'news' | 'estimate' | 'secondary';

/**
 * 이 화면을 지금 무엇이 채울 수 있는가.
 *
 * 로드맵의 수익 구조가 여기에 걸려 있다 — 정형(DB)은 전 종목 무료로 즉시 채워지고,
 * 정성 판정은 에이전트가 생성한다. 그래서 'agent' 는 결함이 아니라 제품의 한 상태다.
 */
export type DataState =
  /** DB 만으로 완결된다. */
  | 'live'
  /** 일부는 DB, 나머지는 에이전트·수집 대기. */
  | 'partial'
  /** 정성 판정이라 에이전트가 써야 한다. */
  | 'agent';

export type BoardId =
  | 'verdict'
  | 'circle'
  | 'primary'
  | 'moat'
  | 'industry'
  | 'valuation'
  | 'price-factors'
  | 'watch';

export type WidgetId =
  // 1 판정 — 판정 자체는 위젯이 아니라 9칸에서 파생되는 전용 화면이다
  // 2 능력범위
  | 'business-model'
  | 'segment-mix'
  // 3 1차 자료
  | 'key-four-metrics'
  | 'cf-investing-notes'
  | 'resource-allocation'
  | 'capa-to-revenue'
  | 'order-contract-signal'
  | 'capex-execution'
  | 'major-shareholder'
  | 'dilution-funding'
  | 'treasury-return'
  | 'ma-org'
  // 4 해자
  | 'moat-type'
  | 'pricing-power'
  | 'management-talent'
  | 'org-people-decision'
  | 'people-profile'
  // 5 산업
  | 'peer-ranking'
  | 'value-chain-map'
  | 'scorecard'
  | 'phase-three-qs'
  | 'bullwhip-cycle'
  // 6 밸류에이션 — 9칸 자체는 위젯이 아니라 전용 인터랙티브 화면이다
  | 'market-share-frame'
  | 'margin-three-layers'
  | 'per-basis'
  | 'cross-check'
  // 7 주가의 3요소
  | 'three-factors'
  // 8 관찰 포인트
  | 'sell-triggers'
  | 'news-yt-facts';

export interface TextbookLink {
  label: string;
  /** 교재 경로, 예: /book/book1/C2 */
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
  /** 논증 순서 1~8. 화면이 메뉴가 아니라 순서라는 걸 UI 가 드러내는 근거. */
  step: number;
  title: string;
  /** 이 단계가 답하는 질문. 제목보다 이쪽이 화면의 목적을 말한다. */
  question: string;
  description: string;
  /** URL segment under /stocks/analysis/[stockCode]/ */
  slug: string;
  kind: 'widgets' | 'source' | 'valuation';
  dataState: DataState;
  /** 이 단계의 근거가 되는 교재 장. */
  textbooks: TextbookLink[];
  widgets: WidgetId[];
  /**
   * dataState 가 'agent' 인 화면에서 "에이전트가 무엇을 써 줄 것인가"를 설명하는 문구.
   * 빈 화면에 "데이터 없음"만 띄우지 않기 위한 것.
   */
  agentPromise?: string;
}

export const TRUST_LABELS: Record<TrustLevel, string> = {
  filing: '공시 확정',
  ir: 'IR',
  news: '뉴스·유튜브',
  estimate: '추정',
  secondary: '2차 자료',
};

export const DATA_STATE_LABELS: Record<DataState, string> = {
  live: '공시 데이터',
  partial: '일부 수집됨',
  agent: 'AI 분석 필요',
};
