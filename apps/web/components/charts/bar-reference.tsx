"use client"

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { month: "January", sales: 186 },
  { month: "February", sales: 305 },
  { month: "March", sales: 237 },
  { month: "April", sales: 73 },
  { month: "May", sales: 209 },
  { month: "June", sales: 214 },
]

const chartConfig = {
  sales: { label: "Sales", color: "var(--chart-1)" },
} satisfies ChartConfig

const goal = 220

export function ChartBarReference({
  data = chartData,
  config = chartConfig,
  xKey = "month",
  dataKey = "sales",
  goalValue = goal,
  goalLabel = "Goal",
  valueFormatter,
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  xKey?: string
  dataKey?: string
  goalValue?: number
  goalLabel?: string
  valueFormatter?: (n: number) => string
} = {}) {
  return (
    <ChartContainer config={config} className="min-h-[220px] w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={valueFormatter}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={valueFormatter ? (v) => valueFormatter(Number(v)) : undefined}
            />
          }
        />
        <ReferenceLine
          y={goalValue}
          stroke="var(--chart-2)"
          strokeDasharray="4 4"
          label={{ value: goalLabel, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
