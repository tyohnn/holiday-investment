"use client"

import { Cell, Funnel, FunnelChart, LabelList } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export type FunnelStep = { step: string; value: number }

const chartData: FunnelStep[] = [
  { step: "Visitors", value: 4800 },
  { step: "Signups", value: 2100 },
  { step: "Activated", value: 1260 },
  { step: "Paid", value: 540 },
]

const chartConfig = {
  value: { label: "Users" },
  visitors: { label: "Visitors", color: "var(--chart-1)" },
  signups: { label: "Signups", color: "var(--chart-2)" },
  activated: { label: "Activated", color: "var(--chart-3)" },
  paid: { label: "Paid", color: "var(--chart-4)" },
} satisfies ChartConfig

/** Cycles through --chart-1..5 when a step has no matching `config` key. */
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function ChartFunnelTemplate({
  data = chartData,
  config = chartConfig,
}: {
  data?: FunnelStep[]
  config?: ChartConfig
} = {}) {
  return (
    <ChartContainer config={config} className="min-h-[280px] w-full">
      <FunnelChart accessibilityLayer>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel nameKey="step" />}
        />
        <Funnel
          data={data}
          dataKey="value"
          nameKey="step"
          isAnimationActive
          lastShapeType="rectangle"
        >
          <LabelList
            dataKey="step"
            position="right"
            fill="var(--foreground)"
            stroke="none"
            className="text-xs"
          />
          {data.map((entry, i) => (
            <Cell key={entry.step} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Funnel>
      </FunnelChart>
    </ChartContainer>
  )
}
