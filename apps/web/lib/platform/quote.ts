/**
 * 시세 조회 — 9칸 매트릭스의 유일한 비-DB 입력.
 *
 * 적정주가 ⑤단계가 `적정시총 ÷ 현재시총 × 현재주가` 라서 주가와 시총이 없으면
 * 상승여력을 못 낸다. 그런데 주가는 `fin_periods` 에 없고 앞으로도 없다(공시 데이터가
 * 아니다). 그래서 여기서 웹으로 받는다.
 *
 * **비공식 엔드포인트다.** 다음금융 내부 API 이므로 예고 없이 바뀌거나 막힐 수 있다.
 * 그래서 이 모듈은 절대 throw 하지 않고 `null` 을 돌려주며, 화면은 수동 입력으로
 * 폴백한다 — 시세 조회가 깨져도 밸류에이션 자체는 계속 쓸 수 있어야 한다.
 */
import 'server-only';

export interface Quote {
  /** 원 */
  price: number;
  /** 원 — 전일 종가 */
  previousClose: number;
  /** 소수 (0.0043 = +0.43%) */
  changeRate: number;
  /** 억 원 — 계산 레이어가 억 원 단위로 돌아간다 */
  marketCapUkwon: number;
  listedShares: number | null;
  /** YYYY-MM-DD */
  date: string;
  source: string;
  /** 수동 입력으로 들어온 값인지 — 화면이 출처를 구분해 표시한다 */
  manual?: boolean;
}

const DAUM_QUOTE_API = 'https://finance.daum.net/api/quotes/';

function quoteUrl(stockCode: string): string {
  return `${DAUM_QUOTE_API}A${stockCode}?summary=false&changeStatistics=true`;
}

export function quoteSourceUrl(stockCode: string): string {
  return `https://finance.daum.net/quotes/A${stockCode}`;
}

/**
 * 5분 캐시. 장중이라도 리서치 화면에 초 단위 정확도는 필요 없고, 종목 화면을
 * 넘나들 때마다 외부 호출이 나가는 걸 막는다.
 */
const REVALIDATE_SECONDS = 300;

export async function getQuote(stockCode: string): Promise<Quote | null> {
  if (!/^\d{6}$/.test(stockCode)) return null;

  try {
    const res = await fetch(quoteUrl(stockCode), {
      headers: {
        // 이 Referer 가 없으면 401 을 준다.
        Referer: quoteSourceUrl(stockCode),
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;

    const raw: unknown = await res.json();
    if (typeof raw !== 'object' || raw === null) return null;
    const d = raw as Record<string, unknown>;

    const price = num(d.tradePrice);
    const marketCap = num(d.marketCap);
    if (price === null || marketCap === null) return null;

    return {
      price,
      previousClose: num(d.prevClosingPrice) ?? price,
      changeRate: num(d.changeRate) ?? 0,
      // marketCap 은 원 단위로 온다. 억 원으로 환산해 계산 레이어와 단위를 맞춘다.
      marketCapUkwon: marketCap / 1e8,
      listedShares: num(d.listedShareCount),
      date: typeof d.date === 'string' ? d.date : '',
      source: quoteSourceUrl(stockCode),
    };
  } catch {
    // 네트워크 실패·JSON 파싱 실패 모두 "시세 없음"으로 수렴시킨다.
    return null;
  }
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 수동 입력 폴백 — 주가와 시총만 있으면 9칸은 계산된다. */
export function manualQuote(price: number, marketCapUkwon: number): Quote {
  return {
    price,
    previousClose: price,
    changeRate: 0,
    marketCapUkwon,
    listedShares: null,
    date: '',
    source: '수동 입력',
    manual: true,
  };
}
