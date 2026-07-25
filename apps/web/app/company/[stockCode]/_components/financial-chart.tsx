'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { CONCEPT_LABELS, formatPercent, formatWon, type AnnualSummary } from '@investment/schema';

const REVENUE_COLOR = '#6366f1';
const OP_INCOME_COLOR = '#22c55e';
const OPM_COLOR = '#f59e0b';

type Row = Pick<AnnualSummary, 'bsns_year' | 'revenue' | 'operating_income' | 'opm_pct'>;

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-fd-border bg-fd-popover p-3 text-xs shadow-md">
      <div className="mb-1.5 font-semibold">{label}년</div>
      {payload.map((entry) => (
        <div key={entry.dataKey as string} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-fd-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.dataKey === 'opm_pct' ? '영업이익률' : CONCEPT_LABELS[entry.dataKey as 'revenue' | 'operating_income']}
          </span>
          <span className="font-medium tabular-nums">
            {entry.dataKey === 'opm_pct'
              ? formatPercent(entry.value as number)
              : `${formatWon(entry.value as number)}원`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FinancialChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-fd-border" />
        <XAxis dataKey="bsns_year" tickFormatter={(y) => `${y}`} tick={{ fontSize: 12 }} />
        <YAxis
          yAxisId="amount"
          tickFormatter={(v) => formatWon(v as number)}
          tick={{ fontSize: 12 }}
          width={64}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 12 }}
          width={48}
        />
        <Tooltip content={CustomTooltip} />
        <Legend
          formatter={(value) =>
            value === 'opm_pct' ? '영업이익률' : CONCEPT_LABELS[value as 'revenue' | 'operating_income']
          }
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar yAxisId="amount" dataKey="revenue" fill={REVENUE_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar
          yAxisId="amount"
          dataKey="operating_income"
          fill={OP_INCOME_COLOR}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="opm_pct"
          stroke={OPM_COLOR}
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
