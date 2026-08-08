import type { AnnualSummary } from '@investment/schema';
import { getQuote, quoteSourceUrl } from '@/lib/platform/quote';
import { NineCellMatrix } from './nine-cell-matrix';

/** 매출 CAGR — 케이스3(낙관: 최근 실적 CAGR 지속)의 출발점. */
function revenueCagr(annual: AnnualSummary[]): number | null {
  const withRev = annual.filter((r) => r.revenue != null && r.revenue > 0);
  if (withRev.length < 2) return null;
  const first = withRev[0];
  const last = withRev[withRev.length - 1];
  const years = last.bsns_year - first.bsns_year;
  if (years <= 0 || !first.revenue || !last.revenue) return null;
  return (last.revenue / first.revenue) ** (1 / years) - 1;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export interface ValuationDefaults {
  baseRevenue: number;
  opmRatio: number;
  growthCases: [number, number, number];
  perCases: [number, number, number];
  revenueCagr: number | null;
  baseYear: number;
}

/**
 * 공시 실적에서 뽑은 가정의 출발점. 판정 화면(1단계)과 밸류에이션 화면(6단계)이
 * 같은 기본값을 써야 두 화면의 숫자가 어긋나지 않는다.
 */
export function deriveValuationDefaults(annual: AnnualSummary[]): ValuationDefaults | null {
  const withRev = annual.filter((r) => r.revenue != null && r.revenue > 0);
  const latest = withRev.length > 0 ? withRev[withRev.length - 1] : null;
  if (!latest || latest.revenue == null) return null;

  const cagr = revenueCagr(withRev);
  const optimistic = cagr != null ? clamp(cagr, 0.0, 0.5) : 0.15;
  const conservative = 0.05;

  return {
    // 억 원 단위로 맞춘다 — 계산 레이어 전체가 억 원이다.
    baseRevenue: latest.revenue / 1e8,
    opmRatio: latest.opm_pct != null ? clamp(latest.opm_pct / 100, 0.01, 0.6) : 0.1,
    // 교재 3케이스: ①산업평균 ②산업평균+알파 ③최근 실적 CAGR 지속
    growthCases: [conservative, clamp((conservative + optimistic) / 2, 0.0, 0.5), optimistic],
    // 한국 시장평균 10배를 가운데가 아니라 하단에 둔다 — 성장주는 그 위에서 논다.
    perCases: [10, 14, 18],
    revenueCagr: cagr,
    baseYear: latest.bsns_year,
  };
}

/**
 * 밸류에이션 화면 — 9칸이 유일한 주인공이다.
 *
 * 가정의 기본값은 공시 실적에서 뽑되, 그건 어디까지나 **출발점**이다. 교재는
 * 케이스1을 "산업 평균(물량 성장 + 인플레)"으로 정의하는데 그 값은 DB 에 없으므로
 * 5%로 두고, 케이스3만 실적 CAGR 로 채운 뒤 사용자가 산업 분석 결과로 교체하게 한다.
 */
export async function ValuationBoard({
  stockCode,
  annual,
}: {
  stockCode: string;
  annual: AnnualSummary[];
}) {
  const withRev = annual.filter((r) => r.revenue != null && r.revenue > 0);
  const latest = withRev.length > 0 ? withRev[withRev.length - 1] : null;
  const defaults = deriveValuationDefaults(annual);

  if (!latest || !defaults) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        매출 실적이 없어 5단계를 시작할 수 없습니다. ①단계의 기준연도 매출이 필요합니다.
      </p>
    );
  }

  const quote = await getQuote(stockCode);
  if (!quote) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm sm:p-8">
        <h2 className="font-semibold">시세를 불러오지 못했습니다</h2>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">
          ⑤단계 적정주가는 <span className="font-mono">적정시총 ÷ 현재시총 × 현재주가</span>{' '}
          라서 시세 없이는 상승여력을 낼 수 없습니다. 시세는 공시 데이터가 아니라 외부
          비공식 경로로 받는데, 그쪽이 응답하지 않았습니다.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          잠시 후 새로고침하거나{' '}
          <a
            href={quoteSourceUrl(stockCode)}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            다음금융에서 직접 확인
          </a>
          하세요. 나머지 단계는 정상 동작합니다.
        </p>
      </div>
    );
  }

  return <NineCellMatrix quote={quote} latest={latest} defaults={defaults} />;
}
