"use client"

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { month: "January", revenue: 1860, margin: 22 },
  { month: "February", revenue: 3050, margin: 28 },
  { month: "March", revenue: 2370, margin: 24 },
  { month: "April", revenue: 1730, margin: 19 },
  { month: "May", revenue: 2090, margin: 26 },
  { month: "June", revenue: 2740, margin: 31 },
]

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  margin: { label: "Margin %", color: "var(--chart-2)" },
} satisfies ChartConfig

export function ChartBarDualAxis({
  data = chartData,
  config = chartConfig,
  xKey = "month",
  barKey = "revenue",
  lineKey = "margin",
  barValueFormatter,
  lineValueFormatter,
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  xKey?: string
  /** Left-axis bar series. */
  barKey?: string
  /** Right-axis line series — a different unit than `barKey`. */
  lineKey?: string
  barValueFormatter?: (n: number) => string
  lineValueFormatter?: (n: number) => string
} = {}) {
  return (
    <ChartContainer config={config} className="min-h-[240px] w-full">
      <ComposedChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis yAxisId="left" tickLine={false} axisLine={false} tickFormatter={barValueFormatter} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickFormatter={lineValueFormatter}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar yAxisId="left" dataKey={barKey} fill={`var(--color-${barKey})`} radius={4} />
        <Line yAxisId="right" dataKey={lineKey} type="monotone" stroke={`var(--color-${lineKey})`} strokeWidth={2} dot />
      </ComposedChart>
    </ChartContainer>
  )
}
