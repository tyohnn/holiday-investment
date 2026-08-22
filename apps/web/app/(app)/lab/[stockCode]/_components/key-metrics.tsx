/**
 * phosphor 의 기본 진입점은 내부에서 React context 를 만들어 클라이언트 경계를 요구한다
 * ("createContext only works in Client Components"). `/dist/ssr` 진입점은 그 context 를
 * 쓰지 않아 서버 컴포넌트에서 그대로 렌더된다 — 이 카드는 상호작용이 없으므로
 * 클라이언트로 내릴 이유가 없다(움직이는 건 MotionCard·StaggerReveal 안쪽뿐이다).
 */
import type { ComponentType } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChartLineUpIcon,
  ScalesIcon,
  TargetIcon,
  WalletIcon,
} from '@phosphor-icons/react/dist/ssr';
// 타입은 ssr 진입점이 재수출하지 않는다. `import type` 은 빌드에서 지워지므로
// 메인 진입점에서 가져와도 클라이언트 경계가 생기지 않는다.
import type { IconProps } from '@phosphor-icons/react';
import { formatPercent, formatWon, type AnnualSummary } from '@investment/schema';
import { cn } from '@/lib/cn';
import { MotionCard } from '@/lib/motion/motion-card';
import { StaggerReveal } from '@/lib/motion/stagger-reveal';

/**
 * 값은 애니메이션하지 않는다.
 *
 * 숫자를 0 에서 세어 올리면 그 사이 화면에 **틀린 재무 수치**가 떠 있다(크래프톤
 * 2025 매출 3.33조가 잠시 1.41조로 보였다). 흘깃 보거나 캡처하면 그대로 오독되므로,
 * 투자 화면에서는 값을 즉시 확정해 보여주고 등장 연출은 카드 단위 stagger 가 맡는다.
 */
function render(value: number | null, format: 'won' | 'percent'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return format === 'won' ? `${formatWon(value)}원` : formatPercent(value);
}

type MetricCard = {
  label: string;
  sub?: string;
  icon: ComponentType<IconProps>;
  value: number | null;
  format: 'won' | 'percent';
  /** pp/% 변화. null이면 배지를 표시하지 않는다. */
  delta: number | null;
  deltaSuffix: string;
  /** 부채비율처럼 값이 내려가는 쪽이 좋은 신호인 지표는 'down'. */
  goodDirection: 'up' | 'down';
};

function DeltaBadge({
  delta,
  deltaSuffix: suffix,
  goodDirection,
}: Pick<MetricCard, 'delta' | 'deltaSuffix' | 'goodDirection'>) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const isGood = goodDirection === 'up' ? delta >= 0 : delta <= 0;
  const Arrow = delta >= 0 ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        isGood ? 'text-positive' : 'text-negative',
      )}
    >
      <Arrow weight="bold" className="size-3" />
      {Math.abs(delta).toFixed(1)}
      {suffix}
    </span>
  );
}

export function KeyMetrics({
  latest,
  previous,
}: {
  latest: AnnualSummary;
  /** 전년도 요약 — 있으면 각 지표에 전년 대비 변화 배지를 붙인다. */
  previous?: AnnualSummary | null;
}) {
  const revenueGrowth =
    previous?.revenue && previous.revenue !== 0 && latest.revenue != null
      ? ((latest.revenue - previous.revenue) / previous.revenue) * 100
      : null;

  const cards: MetricCard[] = [
    {
      label: '매출액',
      sub: `${latest.bsns_year}년`,
      icon: WalletIcon,
      value: latest.revenue,
      format: 'won',
      delta: revenueGrowth,
      deltaSuffix: '%',
      goodDirection: 'up',
    },
    {
      label: '영업이익률',
      icon: ChartLineUpIcon,
      value: latest.opm_pct,
      format: 'percent',
      delta:
        previous?.opm_pct != null && latest.opm_pct != null
          ? latest.opm_pct - previous.opm_pct
          : null,
      deltaSuffix: '%p',
      goodDirection: 'up',
    },
    {
      label: 'ROE',
      icon: TargetIcon,
      value: latest.roe_pct,
      format: 'percent',
      delta:
        previous?.roe_pct != null && latest.roe_pct != null
          ? latest.roe_pct - previous.roe_pct
          : null,
      deltaSuffix: '%p',
      goodDirection: 'up',
    },
    {
      label: '부채비율',
      icon: ScalesIcon,
      value: latest.debt_ratio_pct,
      format: 'percent',
      delta:
        previous?.debt_ratio_pct != null && latest.debt_ratio_pct != null
          ? latest.debt_ratio_pct - previous.debt_ratio_pct
          : null,
      deltaSuffix: '%p',
      goodDirection: 'down',
    },
  ];

  return (
    <StaggerReveal className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <MotionCard
          key={c.label}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {c.label}
              {c.sub && <span className="ml-1 opacity-70">({c.sub})</span>}
            </div>
            <c.icon className="size-3.5 shrink-0 text-muted-foreground/50" />
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <div className="text-xl font-semibold tabular-nums">
              {render(c.value, c.format)}
            </div>
            <DeltaBadge delta={c.delta} deltaSuffix={c.deltaSuffix} goodDirection={c.goodDirection} />
          </div>
        </MotionCard>
      ))}
    </StaggerReveal>
  );
}
