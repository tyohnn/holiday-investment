"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { month: "January", users: 1860, revenue: 12.4 },
  { month: "February", users: 3050, revenue: 18.1 },
  { month: "March", users: 2370, revenue: 15.2 },
  { month: "April", users: 1730, revenue: 11.8 },
  { month: "May", users: 2090, revenue: 14.6 },
  { month: "June", users: 2740, revenue: 19.3 },
]

const chartConfig = {
  users: { label: "Users", color: "var(--chart-1)" },
  revenue: { label: "Revenue ($k)", color: "var(--chart-2)" },
} satisfies ChartConfig

export function ChartLineDualAxis({
  data = chartData,
  config = chartConfig,
  xKey = "month",
  leftKey = "users",
  rightKey = "revenue",
  leftValueFormatter,
  rightValueFormatter,
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  xKey?: string
  leftKey?: string
  rightKey?: string
  leftValueFormatter?: (n: number) => string
  rightValueFormatter?: (n: number) => string
} = {}) {
  return (
    <ChartContainer config={config} className="min-h-[240px] w-full">
      <LineChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis yAxisId="left" tickLine={false} axisLine={false} tickFormatter={leftValueFormatter} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickFormatter={rightValueFormatter}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line yAxisId="left" dataKey={leftKey} type="monotone" stroke={`var(--color-${leftKey})`} strokeWidth={2} dot={false} />
        <Line yAxisId="right" dataKey={rightKey} type="monotone" stroke={`var(--color-${rightKey})`} strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}
