'use client';

import { useMemo, useState } from 'react';
import type { AnnualSummary } from '@investment/schema';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { computeNineCell, practicalPer, type ValuationResult } from '@/lib/valuation/nine-cell';
import type { Quote } from '@/lib/platform/quote';

/** 원 단위 정수를 천 단위 콤마로. 주가는 조·억으로 줄이지 않는다 — 호가는 원 단위로 읽는다. */
const won = (n: number) => n.toLocaleString('ko-KR');
const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;

/**
 * 상승여력에 따른 칸 색.
 *
 * 교재의 매수 기준이 상승여력 200%(3년 3배)이므로 그 선을 색으로 드러낸다 —
 * 플러스면 다 좋아 보이는 그라데이션은 "살 만한가"라는 질문에 답하지 못한다.
 */
function cellTone(upside: number): string {
  if (upside >= 2.0) return 'bg-positive/12 text-positive border-positive/30';
  if (upside >= 0) return 'bg-muted/40 border-border';
  return 'bg-negative/10 text-negative border-negative/25';
}

function AssumptionRow({
  label,
  hint,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        <span className="font-mono text-sm tabular-nums">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      />
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function NineCellMatrix({
  quote,
  defaults,
  latest,
}: {
  quote: Quote;
  defaults: {
    baseRevenue: number;
    opmRatio: number;
    growthCases: [number, number, number];
    perCases: [number, number, number];
    revenueCagr: number | null;
    baseYear: number;
  };
  latest: AnnualSummary | null;
}) {
  const [growths, setGrowths] = useState<[number, number, number]>(defaults.growthCases);
  const [opm, setOpm] = useState(defaults.opmRatio);
  const [pers, setPers] = useState<[number, number, number]>(defaults.perCases);
  const [nail, setNail] = useState({ growthIndex: 1, perIndex: 1 });

  const result: ValuationResult | { error: string } = useMemo(() => {
    try {
      return computeNineCell({
        currentPrice: quote.price,
        currentMarketCap: quote.marketCapUkwon,
        baseRevenue: defaults.baseRevenue,
        opmRatio: opm,
        growthCases: growths,
        perCases: pers,
        nail,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : '계산 실패' };
    }
  }, [quote, defaults.baseRevenue, opm, growths, pers, nail]);

  if ('error' in result) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {result.error}
      </p>
    );
  }

  const trailingPer =
    latest?.operating_income != null
      ? practicalPer(quote.marketCapUkwon, latest.operating_income / 1e8)
      : null;

  const setGrowth = (i: number, v: number) =>
    setGrowths((g) => g.map((x, j) => (j === i ? v : x)) as [number, number, number]);
  const setPer = (i: number, v: number) =>
    setPers((p) => p.map((x, j) => (j === i ? v : x)) as [number, number, number]);

  return (
    <div className="space-y-6">
      {/* 낙점 요약 — 이 화면이 답해야 하는 네 숫자를 맨 위에 둔다. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '낙점 적정주가', value: `${won(result.nail.fairPrice)}원`, tone: '' },
          {
            label: '상승여력',
            value: pct(result.nail.upside),
            tone: result.nail.upside >= 2 ? 'text-positive' : result.nail.upside < 0 ? 'text-negative' : '',
          },
          { label: '진입가 (÷3)', value: `${won(result.entryPrice)}원`, tone: '' },
          {
            label: '안전마진',
            value: result.meetsSafetyMargin ? '충족' : '미달',
            tone: result.meetsSafetyMargin ? 'text-positive' : 'text-muted-foreground',
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className={cn('mt-1 text-xl font-semibold tabular-nums', s.tone)}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* 9칸 매트릭스 */}
        <div className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-md border-separate border-spacing-1 text-sm">
              <caption className="caption-bottom pt-3 text-left text-xs text-muted-foreground">
                칸을 누르면 낙점이 바뀝니다. 초록 = 상승여력 200% 이상(교재 매수 기준).
              </caption>
              <thead>
                <tr>
                  <th className="w-28 px-2 py-1 text-left text-xs font-medium text-muted-foreground">
                    {result.input.years}년 후
                  </th>
                  {pers.map((p, i) => (
                    <th
                      key={i}
                      className="px-2 py-1 text-center text-xs font-medium text-muted-foreground"
                    >
                      PER {p}배
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, gi) => (
                  <tr key={gi}>
                    <th scope="row" className="px-2 py-1 text-left align-middle">
                      <div className="text-xs font-medium">{row.growthLabel}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        순익 {Math.round(row.netIncome).toLocaleString('ko-KR')}억
                      </div>
                    </th>
                    {row.cells.map((cell, pi) => (
                      <td key={pi} className="p-0">
                        <button
                          type="button"
                          onClick={() => setNail({ growthIndex: gi, perIndex: pi })}
                          aria-pressed={cell.isNail}
                          className={cn(
                            'w-full cursor-pointer rounded-lg border px-2 py-2.5 text-center transition-colors',
                            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            cellTone(cell.upside),
                            cell.isNail && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                          )}
                        >
                          <div className="font-semibold tabular-nums">{won(cell.fairPrice)}</div>
                          <div className="text-xs tabular-nums opacity-80">{pct(cell.upside)}</div>
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 낙점 행의 5단계 전개 */}
          <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { n: '①', label: '3년 후 매출', v: `${Math.round(result.rows[nail.growthIndex].revenue).toLocaleString('ko-KR')}억` },
              { n: '②', label: '영업이익', v: `${Math.round(result.rows[nail.growthIndex].operatingIncome).toLocaleString('ko-KR')}억` },
              { n: '③', label: '순이익 (×0.8)', v: `${Math.round(result.rows[nail.growthIndex].netIncome).toLocaleString('ko-KR')}억` },
              { n: '④', label: '적정 시총', v: `${Math.round(result.nail.fairMarketCap).toLocaleString('ko-KR')}억` },
              { n: '⑤', label: '적정 주가', v: `${won(result.nail.fairPrice)}원` },
            ].map((s) => (
              <li key={s.n} className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="text-[11px] text-muted-foreground">
                  {s.n} {s.label}
                </div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{s.v}</div>
              </li>
            ))}
          </ol>
        </div>

        {/* 가정 조정 */}
        <aside className="space-y-5 rounded-xl border border-border bg-card p-4">
          <div>
            <h3 className="text-sm font-semibold">가정</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              기본값은 공시 실적에서 뽑은 출발점입니다. 산업 분석(5단계)의 시장·점유율
              판단으로 교체하세요.
            </p>
          </div>

          {growths.map((g, i) => (
            <AssumptionRow
              key={i}
              label={`성장률 케이스${i + 1}`}
              value={g}
              display={`${(g * 100).toFixed(0)}%`}
              min={-0.2}
              max={0.6}
              step={0.01}
              onChange={(v) => setGrowth(i, v)}
              hint={
                i === 2 && defaults.revenueCagr != null
                  ? `실적 CAGR ${(defaults.revenueCagr * 100).toFixed(1)}%`
                  : undefined
              }
            />
          ))}

          <AssumptionRow
            label="영업이익률"
            value={opm}
            display={`${(opm * 100).toFixed(1)}%`}
            min={0.01}
            max={0.6}
            step={0.005}
            onChange={setOpm}
            hint={`${defaults.baseYear}년 실적 ${(defaults.opmRatio * 100).toFixed(1)}%`}
          />

          {pers.map((p, i) => (
            <AssumptionRow
              key={i}
              label={`적정 PER ${['a', 'b', 'c'][i]}`}
              value={p}
              display={`${p}배`}
              min={3}
              max={40}
              step={1}
              onChange={(v) => setPer(i, v)}
              hint={
                i === 0
                  ? '한국 시장평균 ≈ 10배 · 연 20%+ 고성장 산업 30배 · 1등주 36배'
                  : undefined
              }
            />
          ))}

          <div className="space-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <div className="flex justify-between gap-2">
              <span>기준연도 매출</span>
              <span className="tabular-nums text-foreground">
                {Math.round(defaults.baseRevenue).toLocaleString('ko-KR')}억 ({defaults.baseYear})
              </span>
            </div>
            {trailingPer != null && (
              <div className="flex justify-between gap-2">
                <span>실전 PER (트레일링)</span>
                <span className="tabular-nums text-foreground">{trailingPer}배</span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span>미래 PSR (낙점)</span>
              <span className="tabular-nums text-foreground">{result.futurePsr}배</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>9칸 범위</span>
              <span className="tabular-nums text-foreground">
                {won(result.fairPriceRange[0])}~{won(result.fairPriceRange[1])}원
              </span>
            </div>
          </div>
        </aside>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        이 계산은 교재 방법론(10장 3년 후 적정주가 5단계) 연습이며 투자 권유가 아닙니다.
        모든 값은 위 가정에 따른 추정이고, 가정이 바뀌면 낙점 칸도 바뀝니다.{' '}
        {quote.manual ? (
          <>시세는 수동 입력값입니다.</>
        ) : (
          <>
            시세 기준일 {quote.date || '—'} · 출처{' '}
            <a
              href={quote.source}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              다음금융
            </a>
          </>
        )}
      </p>
    </div>
  );
}
