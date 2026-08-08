import Link from 'next/link';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import type { AnnualSummary } from '@investment/schema';
import { cn } from '@/lib/cn';
import { getQuote } from '@/lib/platform/quote';
import { computeNineCell } from '@/lib/valuation/nine-cell';
import { deriveValuationDefaults } from './valuation-board';

const won = (n: number) => n.toLocaleString('ko-KR');

/**
 * 1단계 판정 — 종목 진입점이 답부터 보여주는 화면.
 *
 * 여기 숫자는 **기본 가정 기준**이다. 가정을 손대는 곳은 6단계 밸류에이션이고,
 * 이 화면은 그 결과를 요약해 "살 만한가"에 먼저 답한다. 두 화면이 같은
 * `deriveValuationDefaults` 를 쓰므로 조정 전 값은 반드시 일치한다.
 */
export async function VerdictBoard({
  stockCode,
  annual,
}: {
  stockCode: string;
  annual: AnnualSummary[];
}) {
  const defaults = deriveValuationDefaults(annual);
  const quote = defaults ? await getQuote(stockCode) : null;

  if (!defaults || !quote) {
    return (
      <section className="rounded-xl border border-dashed border-border p-6 text-sm sm:p-8">
        <h2 className="font-semibold">아직 판정할 수 없습니다</h2>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">
          {!defaults
            ? '매출 실적이 없어 3년 후 적정주가를 계산할 수 없습니다.'
            : '시세를 불러오지 못해 상승여력을 낼 수 없습니다. 잠시 후 다시 시도하세요.'}
        </p>
      </section>
    );
  }

  const r = computeNineCell({
    currentPrice: quote.price,
    currentMarketCap: quote.marketCapUkwon,
    baseRevenue: defaults.baseRevenue,
    opmRatio: defaults.opmRatio,
    growthCases: defaults.growthCases,
    perCases: defaults.perCases,
  });

  const stats = [
    { label: '현재 주가', value: `${won(quote.price)}원`, tone: '' },
    { label: '낙점 적정주가', value: `${won(r.nail.fairPrice)}원`, tone: '' },
    {
      label: '상승여력',
      value: `${r.nail.upside >= 0 ? '+' : ''}${(r.nail.upside * 100).toFixed(1)}%`,
      tone: r.nail.upside >= 2 ? 'text-positive' : r.nail.upside < 0 ? 'text-negative' : '',
    },
    { label: '진입가 (÷3)', value: `${won(r.entryPrice)}원`, tone: '' },
  ];

  return (
    <section className="space-y-4">
      <div
        className={cn(
          'rounded-2xl border p-5 sm:p-6',
          r.meetsSafetyMargin
            ? 'border-positive/40 bg-positive/8'
            : 'border-border bg-card',
        )}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-bold">
            {r.meetsSafetyMargin ? '안전마진 충족' : '안전마진 미달'}
          </h2>
          <span className="text-sm text-muted-foreground">
            교재 매수 기준은 상승여력 200%(3년 3배)입니다
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed">
          기본 가정({r.rows[1].growthLabel} 성장 · 영업이익률{' '}
          {(defaults.opmRatio * 100).toFixed(1)}% · PER {r.nail.per}배) 기준으로 3년 후 적정주가는{' '}
          <strong className="tabular-nums">{won(r.nail.fairPrice)}원</strong>이고, 9칸 전체 범위는{' '}
          <span className="tabular-nums">
            {won(r.fairPriceRange[0])}~{won(r.fairPriceRange[1])}원
          </span>
          입니다.{' '}
          {r.meetsSafetyMargin
            ? `현재가에서 충분한 여력이 있습니다.`
            : `기준을 채우려면 ${won(r.entryPrice)}원 이하에서 사야 합니다.`}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border/60 pt-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className={cn('mt-0.5 text-lg font-semibold tabular-nums', s.tone)}>
                {s.value}
              </dd>
            </div>
          ))}
        </dl>

        <Link
          href={`/lab/${stockCode}/valuation`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          가정을 조정하고 낙점 바꾸기
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        이 판정은 <strong>공시 실적에서 뽑은 기본 가정</strong>만 반영한 것입니다. 교재는
        능력범위(2단계)·해자(4단계)·산업 국면(5단계)을 통과한 뒤에야 이 숫자를 믿으라고 합니다 —
        여기서 끝내지 말고 순서대로 내려가세요.
      </p>
    </section>
  );
}
