/**
 * 산업 지도 IA — 산업 경계·밸류체인 단계·소속 종목의 타입.
 *
 * 이 계층은 **판단**이지 수집 데이터가 아니다. 그래서 DB가 아니라 상수로 둔다
 * (lib/analysis 의 catalog 와 같은 이유·같은 형태). 숫자는 하나도 담지 않는다 —
 * 매출·이익률은 페이지가 fin_periods 에서 읽는다. 상수가 담는 것은 "누가 체인의 어디에
 * 있는가"와 "채(sieve)가 어떻게 판정했는가"뿐이고, 그 둘은 감독이 손으로 확정하는 값이다.
 */

/** 채(sieve) 단계 — 0 KSIC 분할 · 1 산업 판정 · 2 정량 스크린 · 3 해자 · 4 피셔 · 5 적정가 · 6 반증 */
export type SieveStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Verdict = '통과' | '통과철회' | '판정보류' | '실패' | '범위밖';

/** 체인의 축 — 물질이 흐르는 축과, 그 흐름을 가능하게 하는 장비 축은 사이클이 다르다. */
export type ChainAxis = 'material' | 'equipment' | 'holding';

/** 판매 가격이 무엇에 연동되는가. 침체에서 값과 물량이 갈리는 지점이다. */
export type PricingLink = 'metal' | 'volume';

export interface ChainMember {
  name: string;
  /** 국내 상장 종목이면 종목 페이지로 링크된다. 해외·비상장·우선주는 비운다. */
  stockCode?: string;
  /** 체인 안에서 맡은 것 — 동박·분리막처럼 같은 단계 안에서 갈리는 경우 */
  role?: string;
  verdict?: Verdict;
  verdictNote?: string;
  /**
   * 그룹 전체 매출의 대부분이 이 산업 밖에서 나오는 회사.
   * 이 표시가 없으면 화면의 매출·이익률을 산업의 것으로 오독하게 된다.
   */
  conglomerate?: boolean;
}

export interface ValueChainStage {
  id: string;
  name: string;
  axis: ChainAxis;
  /** 이 단계가 하는 일 한 줄 */
  role: string;
  /** 침체 때 실적 악화 폭 순위(1 = 가장 깊게 무너진다) */
  downturnRank?: number;
  /** 회복 때 돈이 도는 순서(1 = 가장 먼저) */
  recoveryRank?: number;
  pricing?: PricingLink;
  /** 셀 공장 장비 투자에서 이 공정이 가져가는 비중(%) — 장비 축에만 있다 */
  capexShare?: number;
  note?: string;
  members: ChainMember[];
}

export interface SourceRef {
  label: string;
  /** 리포지토리 안의 경로. 이 저장소의 `리서치/` 는 웹에 게시되지 않으므로 링크가 아니다. */
  path: string;
}

export interface TextbookRef {
  label: string;
  /** 게시된 교재만 링크를 갖는다(2권은 비공개라 href 가 없다) */
  href?: string;
  note?: string;
}

export interface PhaseQuestion {
  question: string;
  verdict: string;
  detail: string;
}

export interface Industry {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  /**
   * 채 0단계에서 후보 풀을 긁을 때 쓴 KSIC 접두. **경계의 정본이 아니다** —
   * 재현율을 위해 넓게 잡은 그물이고, 실제 경계는 아래 stages 의 members 다.
   * (지도 격자의 하이라이트도 접두가 아니라 members 의 실제 업종코드로 계산한다.)
   */
  ksicPrefixes: string[];
  sieveStage: SieveStage;
  /** 이 판정이 선 날짜 */
  asOf: string;
  sources: SourceRef[];
  textbooks: TextbookRef[];
  phase?: PhaseQuestion[];
  stages: ValueChainStage[];
}
