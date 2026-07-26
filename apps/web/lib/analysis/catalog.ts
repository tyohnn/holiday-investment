import type { AnalysisBoardMeta, AnalysisWidgetMeta, BoardId, WidgetId } from './types';

/** IA 정본 — 사이드바·페이지는 이 상수만 읽는다. */

export const WIDGETS: Record<WidgetId, AnalysisWidgetMeta> = {
  'market-share-frame': {
    id: 'market-share-frame',
    title: '시장 × 점유율 골격',
    claim: '3년 후 매출 = 시장규모 × 점유율로 분해한 현재 가정',
    trust: 'estimate',
    textbooks: [
      { label: '16장 매출 추정의 기술', href: '/docs/book1/C3' },
      { label: '12장 산업 분석 프레임', href: '/docs/book1/B3' },
    ],
  },
  'capa-to-revenue': {
    id: 'capa-to-revenue',
    title: '캐파 → 매출 환산',
    claim: '확정 캐파 × 업종 환산 상수(±가동률)로 매출을 재현한다',
    trust: 'filing',
    textbooks: [
      { label: '16장 매출 추정의 기술', href: '/docs/book1/C3' },
      { label: '19장 1차 자료 읽기', href: '/docs/book1/D1' },
    ],
    trackingTopics: ['캐파-투자집행'],
  },
  'order-contract-signal': {
    id: 'order-contract-signal',
    title: '수주·계약 시그널',
    claim: '바인딩 계약이 매출화되는 시점을 사실 시계열로 본다',
    trust: 'filing',
    textbooks: [{ label: '19장 1차 자료 읽기', href: '/docs/book1/D1' }],
    trackingTopics: ['수주-계약'],
  },
  'capex-execution': {
    id: 'capex-execution',
    title: '투자·공장 이행',
    claim: '발표 vs 착공·CAPEX로 가이던스 사풍(신뢰)을 판정한다',
    trust: 'filing',
    textbooks: [{ label: '16장 매출 추정의 기술', href: '/docs/book1/C3' }],
    trackingTopics: ['캐파-투자집행'],
  },
  'news-yt-facts': {
    id: 'news-yt-facts',
    title: '뉴스·유튜브 팩트',
    claim: '신규공장·계약 체결만 사실 타임라인으로 모은다(해석 제외)',
    trust: 'news',
    textbooks: [
      { label: '19장 1차 자료 읽기', href: '/docs/book1/D1' },
      { label: '20장 언론·리포트·수급', href: '/docs/book1/D2' },
    ],
  },
  'cf-investing-notes': {
    id: 'cf-investing-notes',
    title: 'CF 투자 · 주석',
    claim: '투자활동 현금흐름과 관련 주석에서 실제 집행을 확인한다',
    trust: 'filing',
    textbooks: [{ label: '19장 1차 자료 읽기', href: '/docs/book1/D1' }],
  },
  'key-four-metrics': {
    id: 'key-four-metrics',
    title: '핵심 4지표 추이',
    claim: '매출성장·영업이익률·ROE·부채비율이 밸류에이션 입력값이다',
    trust: 'filing',
    textbooks: [{ label: '19장 1차 자료 읽기', href: '/docs/book1/D1' }],
  },
  'margin-three-layers': {
    id: 'margin-three-layers',
    title: '이익률 3층',
    claim: '가동률 / 원자재 / 가격결정권 중 어디가 마진을 누르는지 나눈다',
    trust: 'estimate',
    textbooks: [
      { label: '16장 매출 추정의 기술', href: '/docs/book1/C3' },
      { label: '12장 산업 분석 프레임', href: '/docs/book1/B3' },
    ],
    trackingTopics: ['이익률-구조'],
  },
  'resource-allocation': {
    id: 'resource-allocation',
    title: '자원 배분 의사결정',
    question: '경영진이 매출을 어디에 쓰고 있는가?',
    claim: '매출원가·판관·인건·CAPEX의 매출 대비 비중 추이가 자원 배분 선택이다',
    trust: 'filing',
    textbooks: [
      { label: '19장 1차 자료 읽기', href: '/docs/book1/D1' },
      { label: '16장 매출 추정의 기술', href: '/docs/book1/C3' },
    ],
    trackingTopics: ['이익률-구조', '캐파-투자집행'],
  },
  'org-people-decision': {
    id: 'org-people-decision',
    title: '사람과 조직 의사결정',
    question: '인력을 늘리는가/줄이는가, 숙련을 쌓는가, 인건 부담은?',
    claim: '인원·근속·인건비/매출 변화가 조직에 대한 경영 선택이다',
    trust: 'filing',
    textbooks: [{ label: '13장 정성분석 피셔', href: '/docs/book1/B4' }],
    trackingTopics: ['경영진-핵심인재'],
  },
  'segment-mix': {
    id: 'segment-mix',
    title: '부문·믹스',
    claim: '제품·지역 믹스가 마진 구조를 어떻게 쓰는지 본다',
    trust: 'filing',
    textbooks: [{ label: '12장 산업 분석 프레임', href: '/docs/book1/B3' }],
    trackingTopics: ['이익률-구조'],
  },
  'major-shareholder': {
    id: 'major-shareholder',
    title: '대주주·지분 변동',
    claim: '오너·대량보유 변화가 이해관계 구조를 바꾼다',
    trust: 'filing',
    textbooks: [{ label: '19장 1차 자료 읽기', href: '/docs/book1/D1' }],
    trackingTopics: ['지분-지배구조'],
  },
  'dilution-funding': {
    id: 'dilution-funding',
    title: '자금조달·희석',
    claim: '유증·CB/BW·오버행이 주주 가치를 희석하는 경로다',
    trust: 'filing',
    textbooks: [{ label: '1장 자금조달과 지분희석', href: '/docs/book1/I1' }],
    trackingTopics: ['자금조달-지분희석'],
  },
  'treasury-return': {
    id: 'treasury-return',
    title: '자사주·주주환원',
    claim: '취득·소각·배당이 주주환원의 실행이다',
    trust: 'filing',
    textbooks: [{ label: '19장 1차 자료 읽기', href: '/docs/book1/D1' }],
    trackingTopics: ['지분-지배구조'],
  },
  'ma-org': {
    id: 'ma-org',
    title: '인수합병·조직',
    claim: 'M&A·조직 개편 사실 시계열이 전략 전환의 흔적이다',
    trust: 'filing',
    textbooks: [{ label: '13장 정성분석 피셔', href: '/docs/book1/B4' }],
  },
  'management-talent': {
    id: 'management-talent',
    title: '경영진·핵심인재',
    claim: 'CEO·핵심 인력 이동이 실행력과 문화 신호다',
    trust: 'filing',
    textbooks: [{ label: '13장 정성분석 피셔', href: '/docs/book1/B4' }],
    trackingTopics: ['경영진-핵심인재'],
  },
  'people-profile': {
    id: 'people-profile',
    title: '사람 프로필',
    claim: '배경·발언으로 의사결정자의 관점을 파악한다(2차 자료)',
    trust: 'secondary',
    textbooks: [{ label: '13장 정성분석 피셔', href: '/docs/book1/B4' }],
  },
  'value-chain-map': {
    id: 'value-chain-map',
    title: '밸류체인 지도',
    claim: '이 종목이 체인 어디에 있는지부터 잡는다',
    trust: 'estimate',
    textbooks: [
      { label: '12장 산업 분석 프레임', href: '/docs/book1/B3' },
      { label: '2권 밸류체인 지도', href: '/docs/book2/D1' },
    ],
  },
  'scorecard': {
    id: 'scorecard',
    title: '경쟁력 축·채점표',
    claim: '산업 고유 축으로 기업 서열을 매긴다',
    trust: 'estimate',
    textbooks: [{ label: '12장 산업 분석 프레임', href: '/docs/book1/B3' }],
  },
  'phase-three-qs': {
    id: 'phase-three-qs',
    title: '국면 3문',
    claim: '시장규모·점유율·이익률 국면을 세 문장으로 점검한다',
    trust: 'estimate',
    textbooks: [{ label: '12장 산업 분석 프레임', href: '/docs/book1/B3' }],
  },
  'bullwhip-cycle': {
    id: 'bullwhip-cycle',
    title: '채찍효과·사이클',
    claim: '침체·회복에서 돈이 도는 순서를 본다',
    trust: 'estimate',
    textbooks: [{ label: '2권 밸류체인 지도', href: '/docs/book2/D1' }],
  },
  'study-links': {
    id: 'study-links',
    title: '기술 공부 링크',
    claim: '산업·기술 개념은 교재에서, 적용은 분석 화면에서',
    trust: 'ir',
    textbooks: [
      { label: '2권 시작', href: '/docs/book2' },
      { label: '1권 산업 프레임', href: '/docs/book1/B3' },
    ],
  },
  'agent-chat': {
    id: 'agent-chat',
    title: 'AI 보조',
    claim: '현재 분석 화면 맥락으로 해석·위젯 근거를 묻는다(레이아웃 편집 없음)',
    trust: 'estimate',
    textbooks: [],
  },
};

export const BOARDS: AnalysisBoardMeta[] = [
  {
    id: 'revenue',
    section: 'company',
    title: '앞으로의 매출 변화',
    description: '시장×점유율·캐파·수주·투자 이행으로 매출 방향을 본다',
    slug: 'revenue',
    kind: 'widgets',
    widgets: [
      'market-share-frame',
      'capa-to-revenue',
      'order-contract-signal',
      'capex-execution',
      'news-yt-facts',
      'cf-investing-notes',
    ],
  },
  {
    id: 'numbers',
    section: 'company',
    title: '숫자로 보기',
    description: '재무 구조와 경영의 자원·조직 의사결정을 숫자로 읽는다',
    slug: 'numbers',
    kind: 'widgets',
    widgets: [
      'key-four-metrics',
      'margin-three-layers',
      'resource-allocation',
      'org-people-decision',
      'segment-mix',
    ],
  },
  {
    id: 'people',
    section: 'company',
    title: '구성원 변화',
    description: '대주주·희석·환원·M&A·경영진 변화를 추적한다',
    slug: 'people',
    kind: 'widgets',
    widgets: [
      'major-shareholder',
      'dilution-funding',
      'treasury-return',
      'ma-org',
      'management-talent',
      'people-profile',
    ],
  },
  {
    id: 'financials',
    section: 'company',
    title: '재무 전체보기',
    description: '공시·재무·트래킹 원천 데이터',
    slug: 'financials',
    kind: 'source',
    widgets: [],
  },
  {
    id: 'industry',
    section: 'industry',
    title: '밸류체인 / 부품',
    description: '산업 위치·경쟁력 축·국면',
    slug: 'industry',
    kind: 'widgets',
    widgets: ['value-chain-map', 'scorecard', 'phase-three-qs', 'bullwhip-cycle'],
  },
  {
    id: 'study',
    section: 'industry',
    title: '기술 공부',
    description: '교재로 산업·기술 개념을 학습한다',
    slug: 'study',
    kind: 'hub',
    widgets: ['study-links'],
  },
  {
    id: 'agent',
    section: 'agent',
    title: 'AI 에이전트',
    description: '분석 화면 해석을 돕는 보조 대화',
    slug: 'agent',
    kind: 'agent',
    widgets: ['agent-chat'],
  },
];

export const SECTION_LABELS: Record<AnalysisBoardMeta['section'], string> = {
  company: '기업분석',
  industry: '산업분석',
  agent: 'AI 에이전트',
};

export const DEFAULT_BOARD_ID: BoardId = 'revenue';

export function getBoard(id: BoardId): AnalysisBoardMeta {
  const board = BOARDS.find((b) => b.id === id);
  if (!board) throw new Error(`Unknown board: ${id}`);
  return board;
}

export function getBoardBySlug(slug: string): AnalysisBoardMeta | undefined {
  return BOARDS.find((b) => b.slug === slug);
}

export function boardHref(stockCode: string, boardId: BoardId = DEFAULT_BOARD_ID): string {
  const board = getBoard(boardId);
  return `/company/${stockCode}/${board.slug}`;
}

export function widgetsForBoard(boardId: BoardId): AnalysisWidgetMeta[] {
  return getBoard(boardId).widgets.map((id) => WIDGETS[id]);
}
