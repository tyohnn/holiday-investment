/**
 * 3년 후 적정주가 5단계 + 9칸 시나리오 매트릭스 (교재 10장 C2).
 *
 * `plugin/skills/company-analysis/scripts/valuation.py` 의 계산을 그대로 옮긴 것이다.
 * 리포트(에이전트가 파이썬으로 계산)와 대시보드(여기)가 같은 숫자를 내야 하므로,
 * 산식·반올림 위치를 바꾸지 않는다. 산식을 고칠 일이 생기면 양쪽을 함께 고친다.
 *
 * 단위 규약 — 금액은 **억 원**, 주가는 **원**, 비율은 소수(23% → 0.23).
 *
 *   ① 3년 후 매출 = 기준연도 매출 × 누적성장배수
 *   ② 영업이익   = 매출 × 영업이익률
 *   ③ 순이익     = 영업이익 × 0.8            (법인세 근사)
 *   ④ 적정 시총  = 순이익 × 적정 PER
 *   ⑤ 적정 주가  = 적정시총 ÷ 현재시총 × 현재주가   (발행주식수 불필요한 비례식)
 */

/** 균등 CAGR(소수 하나) 또는 연차별 경로(배열). 배열 길이는 `years` 와 같아야 한다. */
export type GrowthCase = number | number[];

export interface ValuationInput {
  /** 원 */
  currentPrice: number;
  /** 억 원 */
  currentMarketCap: number;
  /** 억 원 — 보통 최근 연간 매출 */
  baseRevenue: number;
  /** 영업이익률, 0~1 소수 */
  opmRatio: number;
  growthCases: readonly [GrowthCase, GrowthCase, GrowthCase];
  perCases: readonly [number, number, number];
  /** 9칸 중 낙점. 생략하면 가운데 칸(케이스2 × PER b)을 잠정 낙점으로 쓴다. */
  nail?: { growthIndex: number; perIndex: number };
  /** 법인세 근사 계수. 기본 0.8 */
  taxFactor?: number;
  /** 기본 3 */
  years?: number;
}

export interface ValuationCell {
  per: number;
  /** 억 원 */
  fairMarketCap: number;
  /** 원 */
  fairPrice: number;
  /** 소수 — 2.0 이면 +200% */
  upside: number;
  isNail: boolean;
}

export interface ValuationRow {
  growth: GrowthCase;
  /** 표시용 — 배열이면 CAGR 환산치를 병기한다. */
  growthLabel: string;
  /** 억 원 */
  revenue: number;
  /** 억 원 */
  operatingIncome: number;
  /** 억 원 */
  netIncome: number;
  cells: ValuationCell[];
}

export interface ValuationResult {
  rows: ValuationRow[];
  /** 원 — 9칸 최소·최대 */
  fairPriceRange: [number, number];
  upsideRange: [number, number];
  nail: {
    growth: GrowthCase;
    growthLabel: string;
    per: number;
    fairMarketCap: number;
    fairPrice: number;
    upside: number;
  };
  /** 원 — 낙점 적정주가 ÷ 3 (교재 2장 A2 안전마진) */
  entryPrice: number;
  /** 상승여력 ≥ 200% (3년 3배) */
  meetsSafetyMargin: boolean;
  /** 낙점 행의 3년 후 매출 기준 미래 PSR */
  futurePsr: number;
  input: Required<Omit<ValuationInput, 'nail'>> & { nail: { growthIndex: number; perIndex: number } };
}

/** 성장률 → 누적 성장 배수. */
export function growthFactor(g: GrowthCase, years: number): number {
  if (Array.isArray(g)) return g.reduce((f, y) => f * (1 + y), 1);
  return (1 + g) ** years;
}

export function growthLabel(g: GrowthCase, years: number): string {
  if (Array.isArray(g)) {
    const cagr = growthFactor(g, years) ** (1 / g.length) - 1;
    const path = g.map((y) => `${round1(y * 100)}%`).join('/');
    return `경로 ${path} (CAGR ${round1(cagr * 100)}%)`;
  }
  return `${round1(g * 100)}%`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export class ValuationInputError extends Error {}

/**
 * 파이썬 쪽 `load_assumptions` 의 검증을 옮긴 것. 슬라이더 UI 가 범위를 강제하더라도
 * 저장된 가정을 다시 읽는 경로가 생기므로 계산 직전에 한 번 더 막는다.
 */
function validate(input: ValuationInput, years: number): void {
  if (!(input.currentMarketCap > 0)) {
    throw new ValuationInputError('현재 시가총액이 필요하다 — ⑤단계의 분모다.');
  }
  if (!(input.currentPrice > 0)) {
    throw new ValuationInputError('현재 주가가 필요하다.');
  }
  if (!(input.baseRevenue > 0)) {
    throw new ValuationInputError('기준연도 매출이 필요하다.');
  }
  if (!(input.opmRatio > 0 && input.opmRatio < 1)) {
    throw new ValuationInputError('영업이익률은 0~1 사이 소수여야 한다 (23% → 0.23).');
  }
  for (const g of input.growthCases) {
    const path = Array.isArray(g) ? g : [g];
    if (Array.isArray(g) && g.length !== years) {
      throw new ValuationInputError(`연차별 성장률 배열의 길이는 연수(${years})와 같아야 한다.`);
    }
    for (const y of path) {
      if (!(y > -0.9 && y < 3.0)) {
        throw new ValuationInputError(`성장률 ${y} 은 소수여야 한다 (20% → 0.20).`);
      }
    }
  }
}

export function computeNineCell(input: ValuationInput): ValuationResult {
  const years = input.years ?? 3;
  const taxFactor = input.taxFactor ?? 0.8;
  validate(input, years);

  const { currentPrice, currentMarketCap, baseRevenue, opmRatio } = input;
  const nailAt = input.nail ?? { growthIndex: 1, perIndex: 1 };

  const rows: ValuationRow[] = input.growthCases.map((growth, gi) => {
    const revenue = baseRevenue * growthFactor(growth, years);
    const operatingIncome = revenue * opmRatio;
    const netIncome = operatingIncome * taxFactor;

    const cells: ValuationCell[] = input.perCases.map((per, pi) => {
      const fairMarketCap = netIncome * per;
      // 발행주식수를 몰라도 되는 비례식 — 시총 비율이 곧 주가 비율이다.
      const fairPrice = (fairMarketCap / currentMarketCap) * currentPrice;
      return {
        per,
        fairMarketCap: round1(fairMarketCap),
        fairPrice: Math.round(fairPrice),
        upside: Math.round((fairPrice / currentPrice - 1) * 1e4) / 1e4,
        isNail: gi === nailAt.growthIndex && pi === nailAt.perIndex,
      };
    });

    return {
      growth,
      growthLabel: growthLabel(growth, years),
      revenue: round1(revenue),
      operatingIncome: round1(operatingIncome),
      netIncome: round1(netIncome),
      cells,
    };
  });

  const nailRow = rows[nailAt.growthIndex];
  const nailCell = nailRow.cells[nailAt.perIndex];
  const prices = rows.flatMap((r) => r.cells.map((c) => c.fairPrice));
  const upsides = rows.flatMap((r) => r.cells.map((c) => c.upside));

  return {
    rows,
    fairPriceRange: [Math.min(...prices), Math.max(...prices)],
    upsideRange: [Math.min(...upsides), Math.max(...upsides)],
    nail: {
      growth: nailRow.growth,
      growthLabel: nailRow.growthLabel,
      per: nailCell.per,
      fairMarketCap: nailCell.fairMarketCap,
      fairPrice: nailCell.fairPrice,
      upside: nailCell.upside,
    },
    entryPrice: Math.round(nailCell.fairPrice / 3),
    meetsSafetyMargin: nailCell.upside >= 2.0,
    futurePsr: Math.round((currentMarketCap / nailRow.revenue) * 100) / 100,
    input: {
      currentPrice,
      currentMarketCap,
      baseRevenue,
      opmRatio,
      growthCases: input.growthCases,
      perCases: input.perCases,
      taxFactor,
      years,
      nail: nailAt,
    },
  };
}

/**
 * 실전 PER = 시가총액 ÷ (영업이익 × 0.8). 교재 9장 C1 — 주가·EPS 가 아니라 시총으로,
 * 당기순이익이 아니라 영업이익×80% 로 계산한다(순이익은 일회성 손익으로 오염된다).
 */
export function practicalPer(
  marketCap: number,
  operatingIncome: number,
  taxFactor = 0.8,
): number | null {
  if (!(operatingIncome > 0) || !(marketCap > 0)) return null;
  return round1(marketCap / (operatingIncome * taxFactor));
}
