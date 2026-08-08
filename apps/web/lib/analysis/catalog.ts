import type { AnalysisBoardMeta, AnalysisWidgetMeta, BoardId, WidgetId } from './types';

/**
 * IA 정본 — 사이드바·페이지는 이 상수만 읽는다.
 *
 * 보드 순서는 교재의 의존 그래프 그대로다:
 *   B1 능력범위(5장) → B2 해자(6장) → B3 산업(7장) → C3 매출(11장)
 *   → C2 5단계·9칸(10장) ← C1 PER(9장) → A2 진입가 ÷3(2장)
 * 그리고 리포트 골격(report-templates.md)과 1:1 이다. 판정만 맨 앞으로 당겼다 —
 * 리포트는 §1 요약에 판정 한 문장을 두고 §7 에서 상술하는데, 화면에서는 "답"이
 * 랜딩이어야 하기 때문이다.
 *
 * 장 번호는 교재 INDEX.md 가 정본이다. `#숫자` 기법 번호는 교재에 존재하지 않으므로
 * 쓰지 않는다(AGENTS.md 참조).
 */

const B1 = { label: '5장 능력범위', href: '/book/book1/B1' };
const B2 = { label: '6장 경제적 해자와 가격결정권', href: '/book/book1/B2' };
const B3 = { label: '7장 산업 분석 프레임', href: '/book/book1/B3' };
const B4 = { label: '8장 정성분석 피셔 15포인트', href: '/book/book1/B4' };
const C1 = { label: '9장 PER 바로 쓰기', href: '/book/book1/C1' };
const C2 = { label: '10장 3년 후 적정주가 5단계', href: '/book/book1/C2' };
const C3 = { label: '11장 매출 추정의 기술', href: '/book/book1/C3' };
const C5 = { label: '13장 상대가치와 저평가 사다리', href: '/book/book1/C5' };
const D1 = { label: '14장 1차 자료 읽기', href: '/book/book1/D1' };
const D2 = { label: '15장 언론·리포트·수급', href: '/book/book1/D2' };
const A2 = { label: '2장 안전마진과 십루타', href: '/book/book1/A2' };
const A3 = { label: '3장 주가의 3요소', href: '/book/book1/A3' };
const A4 = { label: '4장 보유 규율', href: '/book/book1/A4' };
const E2 = { label: '17장 종목 편입과 구성 5단계', href: '/book/book1/E2' };
const F1 = { label: '19장 매도와 종목교체', href: '/book/book1/F1' };
const I1 = { label: '26장 자금조달과 지분희석', href: '/book/book1/I1' };

export const WIDGETS: Record<WidgetId, AnalysisWidgetMeta> = {
  // ── 2 능력범위 ────────────────────────────────────────────────────────────
  'business-model': {
    id: 'business-model',
    title: '무엇으로 돈을 버는가',
    question: '사업부문과 매출 비중으로 수익원을 한 문단에 적을 수 있는가?',
    claim: '수익원을 스스로 설명하지 못하면 3년 후 추정도 불가능하다',
    trust: 'filing',
    textbooks: [B1],
  },
  'segment-mix': {
    id: 'segment-mix',
    title: '부문·믹스',
    claim: '제품·지역 믹스가 마진 구조를 어떻게 쓰는지 본다',
    trust: 'filing',
    textbooks: [B1, B3],
    trackingTopics: ['이익률-구조'],
  },

  // ── 3 1차 자료 ────────────────────────────────────────────────────────────
  'key-four-metrics': {
    id: 'key-four-metrics',
    title: '핵심 4지표 추이',
    claim: '매출성장·영업이익률·ROE·부채비율이 밸류에이션 입력값이다',
    trust: 'filing',
    textbooks: [D1],
  },
  'cf-investing-notes': {
    id: 'cf-investing-notes',
    title: 'CF 투자 · 주석',
    claim: '투자활동 현금흐름과 관련 주석에서 실제 집행을 확인한다',
    trust: 'filing',
    textbooks: [D1],
  },
  'resource-allocation': {
    id: 'resource-allocation',
    title: '자원 배분 의사결정',
    question: '경영진이 매출을 어디에 쓰고 있는가?',
    claim: '매출원가·판관·인건·CAPEX의 매출 대비 비중 추이가 자원 배분 선택이다',
    trust: 'filing',
    textbooks: [D1, C3],
    trackingTopics: ['이익률-구조', '캐파-투자집행'],
  },
  'capa-to-revenue': {
    id: 'capa-to-revenue',
    title: '캐파 → 매출 환산',
    claim: '확정 캐파 × 업종 환산 상수(±가동률)로 매출을 재현한다',
    trust: 'filing',
    textbooks: [C3, D1],
    trackingTopics: ['캐파-투자집행'],
  },
  'order-contract-signal': {
    id: 'order-contract-signal',
    title: '수주·계약 시그널',
    claim: '바인딩 계약이 매출화되는 시점을 사실 시계열로 본다',
    trust: 'filing',
    textbooks: [D1],
    trackingTopics: ['수주-계약'],
  },
  'capex-execution': {
    id: 'capex-execution',
    title: '투자·공장 이행',
    claim: '발표 vs 착공·CAPEX로 가이던스 사풍(신뢰)을 판정한다',
    trust: 'filing',
    textbooks: [C3],
    trackingTopics: ['캐파-투자집행'],
  },
  'major-shareholder': {
    id: 'major-shareholder',
    title: '대주주·지분 변동',
    claim: '오너·대량보유 변화가 이해관계 구조를 바꾼다',
    trust: 'filing',
    textbooks: [D1],
    trackingTopics: ['지분-지배구조'],
  },
  'dilution-funding': {
    id: 'dilution-funding',
    title: '자금조달·희석',
    claim: '유증·CB/BW·오버행이 주주 가치를 희석하는 경로다',
    trust: 'filing',
    textbooks: [I1],
    trackingTopics: ['자금조달-지분희석'],
  },
  'treasury-return': {
    id: 'treasury-return',
    title: '자사주·주주환원',
    claim: '취득·소각·배당이 주주환원의 실행이다',
    trust: 'filing',
    textbooks: [D1],
    trackingTopics: ['지분-지배구조'],
  },
  'ma-org': {
    id: 'ma-org',
    title: '인수합병·조직',
    claim: 'M&A·조직 개편 사실 시계열이 전략 전환의 흔적이다',
    trust: 'filing',
    textbooks: [B4],
  },

  // ── 4 해자 ────────────────────────────────────────────────────────────────
  'moat-type': {
    id: 'moat-type',
    title: '해자 유형',
    question: '팻 도시 4유형 중 어디에 해당하고, 증거는 무엇인가?',
    claim: '무형자산·전환비용·네트워크효과·원가우위 중 하나를 증거와 함께 지목한다',
    trust: 'estimate',
    textbooks: [B2],
  },
  'pricing-power': {
    id: 'pricing-power',
    title: '가격결정권',
    question: '가격을 올려도 고객이 떠나지 않는가? 세계 1등인가?',
    claim: '해자의 최종 시험은 가격결정권이다 — peer 이익률 격차가 그 흔적이다',
    trust: 'estimate',
    textbooks: [B2],
  },
  'management-talent': {
    id: 'management-talent',
    title: '경영진·핵심인재',
    claim: 'CEO·핵심 인력 이동이 실행력과 문화 신호다',
    trust: 'filing',
    textbooks: [B4],
    trackingTopics: ['경영진-핵심인재'],
  },
  'org-people-decision': {
    id: 'org-people-decision',
    title: '사람과 조직 의사결정',
    question: '인력을 늘리는가/줄이는가, 숙련을 쌓는가, 인건 부담은?',
    claim: '인원·근속·인건비/매출 변화가 조직에 대한 경영 선택이다',
    trust: 'filing',
    textbooks: [B4],
    trackingTopics: ['경영진-핵심인재'],
  },
  'people-profile': {
    id: 'people-profile',
    title: '사람 프로필',
    claim: '배경·발언으로 의사결정자의 관점을 파악한다(2차 자료)',
    trust: 'secondary',
    textbooks: [B4],
  },

  // ── 5 산업 ────────────────────────────────────────────────────────────────
  'peer-ranking': {
    id: 'peer-ranking',
    title: '경쟁력 순위표',
    question: '같은 업종에서 이 회사는 몇 등인가?',
    claim: '산업 분석의 첫 산출물 — 이 순위표가 점유율 추정의 근거가 된다',
    trust: 'filing',
    textbooks: [B3, C5],
  },
  'value-chain-map': {
    id: 'value-chain-map',
    title: '밸류체인 지도',
    claim: '이 종목이 체인 어디에 있는지부터 잡는다',
    trust: 'estimate',
    textbooks: [B3],
  },
  'scorecard': {
    id: 'scorecard',
    title: '승부의 축·채점표',
    claim: '산업 고유 축으로 기업 서열을 매긴다 — 게임에 제조업 잣대를 대지 않는다',
    trust: 'estimate',
    textbooks: [B3],
  },
  'phase-three-qs': {
    id: 'phase-three-qs',
    title: '국면 3문',
    question: '① 캐즘을 넘었는가 ② 쪼개도 이기는가 ③ 이익률 하락은 어느 층인가',
    claim: '이 세 답이 5단계의 시장크기·점유율·이익률 가정이 된다',
    trust: 'estimate',
    textbooks: [B3],
  },
  'bullwhip-cycle': {
    id: 'bullwhip-cycle',
    title: '채찍효과·사이클',
    claim: '침체·회복에서 돈이 도는 순서를 본다',
    trust: 'estimate',
    textbooks: [B3],
  },

  // ── 6 밸류에이션 ──────────────────────────────────────────────────────────
  'market-share-frame': {
    id: 'market-share-frame',
    title: '① 3년 후 매출',
    question: '시장규모 × 점유율을 무엇으로 채우는가?',
    claim: '5단계의 첫 칸 — 산업 성장성보다 점유율(산업 내 경쟁력)이 더 중요하다',
    trust: 'estimate',
    textbooks: [C3, B3],
  },
  'margin-three-layers': {
    id: 'margin-three-layers',
    title: '② 영업이익률 3층',
    claim: '가동률 / 원자재 / 가격결정권 중 어디가 마진을 누르는지 나눈다',
    trust: 'estimate',
    textbooks: [C2, B3],
    trackingTopics: ['이익률-구조'],
  },
  'per-basis': {
    id: 'per-basis',
    title: '④ 적정 PER 근거',
    question: '이 배수를 부여하는 근거가 무엇인가?',
    claim: '실전 PER = 시총 ÷ (영업이익 × 0.8). 배수 부여는 성장성 + 리스크 프리미엄이다',
    trust: 'estimate',
    textbooks: [C1],
  },
  'cross-check': {
    id: 'cross-check',
    title: '교차검증',
    claim: '가이던스 정합·피어 PER·미래 PSR 중 최소 하나로 낙점을 반증한다',
    trust: 'estimate',
    textbooks: [C5, D2],
  },

  // ── 7 주가의 3요소 ────────────────────────────────────────────────────────
  'three-factors': {
    id: 'three-factors',
    title: '주가의 3요소',
    question: '최근 주가를 움직인 것은 내재가치·외부 재료·시장 인식 중 무엇인가?',
    claim: '셋을 구분해야 폭락을 기회로 읽을지 경고로 읽을지 갈린다',
    trust: 'estimate',
    textbooks: [A3, D2],
  },

  // ── 8 관찰 포인트 ─────────────────────────────────────────────────────────
  'sell-triggers': {
    id: 'sell-triggers',
    title: '스토리 훼손 조건',
    question: '무엇이 사실로 확인되면 파는가?',
    claim: '매도 트리거를 미리 적어 두는 것이 보유 규율이다',
    trust: 'estimate',
    textbooks: [A4, F1],
  },
  'news-yt-facts': {
    id: 'news-yt-facts',
    title: '팩트 추적',
    claim: '신규공장·계약 체결만 사실 타임라인으로 모은다(해석 제외)',
    trust: 'news',
    textbooks: [D1, D2],
  },
};

export const BOARDS: AnalysisBoardMeta[] = [
  {
    id: 'verdict',
    step: 1,
    title: '판정',
    question: '살 만한가, 얼마에',
    description: '낙점 적정주가·상승여력·진입가로 편입 여부를 판정한다',
    slug: 'verdict',
    kind: 'widgets',
    dataState: 'partial',
    textbooks: [A2, E2],
    widgets: [],
  },
  {
    id: 'circle',
    step: 2,
    title: '능력범위',
    question: '내가 이 회사의 3년 후를 추정할 수 있는가',
    description: '무엇으로 돈을 버는 회사인지부터 스스로 설명할 수 있어야 한다',
    slug: 'circle',
    kind: 'widgets',
    dataState: 'partial',
    textbooks: [B1],
    widgets: ['business-model', 'segment-mix'],
    agentPromise: '사업부문·매출 비중을 사업보고서에서 뽑아 수익원을 정리합니다.',
  },
  {
    id: 'primary',
    step: 3,
    title: '1차 자료',
    question: '숫자는 어디서 왔는가',
    description: '재무 추이·공시·정정 체인·지분·자금조달 — 모든 추정의 원천',
    slug: 'primary',
    kind: 'source',
    dataState: 'live',
    textbooks: [D1, I1],
    widgets: [
      'key-four-metrics',
      'cf-investing-notes',
      'resource-allocation',
      'capa-to-revenue',
      'order-contract-signal',
      'capex-execution',
      'major-shareholder',
      'dilution-funding',
      'treasury-return',
      'ma-org',
    ],
  },
  {
    id: 'moat',
    step: 4,
    title: '해자',
    question: '이 우위가 지속되는가',
    description: '팻 도시 4유형·가격결정권·피셔 정성 점검',
    slug: 'moat',
    kind: 'widgets',
    dataState: 'agent',
    textbooks: [B2, B4],
    widgets: [
      'moat-type',
      'pricing-power',
      'management-talent',
      'org-people-decision',
      'people-profile',
    ],
    agentPromise:
      '공시·IR·뉴스·유튜브를 읽어 해자 유형과 가격결정권을 증거와 함께 판정합니다.',
  },
  {
    id: 'industry',
    step: 5,
    title: '산업',
    question: '승부의 축과 국면은 무엇인가',
    description: '경쟁력 순위표·국면 3문·밸류체인 — 네 산출물이 다음 계산의 입력이 된다',
    slug: 'industry',
    kind: 'widgets',
    dataState: 'partial',
    textbooks: [B3],
    widgets: ['peer-ranking', 'scorecard', 'phase-three-qs', 'value-chain-map', 'bullwhip-cycle'],
    agentPromise: '업종 peer 재무는 자동 계산되고, 승부의 축과 국면 판단은 AI가 씁니다.',
  },
  {
    id: 'valuation',
    step: 6,
    title: '밸류에이션',
    question: '3년 뒤 얼마짜리인가',
    description: '3년 후 적정주가 5단계와 9칸 시나리오 매트릭스',
    slug: 'valuation',
    kind: 'valuation',
    dataState: 'live',
    textbooks: [C2, C1, C3],
    widgets: [
      'market-share-frame',
      'margin-three-layers',
      'per-basis',
      'cross-check',
    ],
  },
  {
    id: 'price-factors',
    step: 7,
    title: '주가의 3요소',
    question: '최근 주가는 무엇이 움직였나',
    description: '내재가치·외부 재료·시장 인식을 구분한다',
    slug: 'price-factors',
    kind: 'widgets',
    dataState: 'agent',
    textbooks: [A3],
    widgets: ['three-factors'],
    agentPromise: '주가 국면을 세 요소로 분해하고 폭락·급등의 성격을 판정합니다.',
  },
  {
    id: 'watch',
    step: 8,
    title: '관찰 포인트',
    question: '무엇이 틀리면 파는가',
    description: '스토리 훼손 조건과 팩트 추적 캘린더',
    slug: 'watch',
    kind: 'widgets',
    dataState: 'agent',
    textbooks: [A4, F1],
    widgets: ['sell-triggers', 'news-yt-facts'],
    agentPromise: '매도 트리거와 향후 12개월 확인 이벤트를 목록으로 만듭니다.',
  },
];

export const DEFAULT_BOARD_ID: BoardId = 'verdict';

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
  return `/lab/${stockCode}/${board.slug}`;
}

export function widgetsForBoard(boardId: BoardId): AnalysisWidgetMeta[] {
  return getBoard(boardId).widgets.map((id) => WIDGETS[id]);
}

/**
 * 옛 슬러그 → 새 슬러그. 북마크·외부 링크가 깨지지 않도록 라우트가 301 한다.
 * 구성원 변화(people)는 지분·자금조달이 1차 자료로 흡수됐고, 기술 공부(study)는
 * 종목 IA 에서 빠져 별도 기술 페이지로 갈 예정이라 판정으로 보낸다.
 */
export const LEGACY_BOARD_SLUGS: Record<string, string> = {
  revenue: 'valuation',
  numbers: 'primary',
  people: 'primary',
  financials: 'primary',
  study: 'verdict',
  agent: 'verdict',
};
