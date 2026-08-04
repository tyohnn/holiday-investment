"use client"

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { region: "North", delta: 18 },
  { region: "East", delta: -12 },
  { region: "South", delta: 9 },
  { region: "West", delta: -7 },
  { region: "Central", delta: 14 },
  { region: "APAC", delta: -15 },
]

const chartConfig = {
  delta: { label: "Δ vs plan" },
  positive: { label: "Above plan", color: "var(--chart-2)" },
  negative: { label: "Below plan", color: "var(--chart-5)" },
} satisfies ChartConfig

export function ChartBarDiverging({
  data = chartData,
  config = chartConfig,
  xKey = "region",
  dataKey = "delta",
  domain = [-20, 24],
  valueFormatter,
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  xKey?: string
  dataKey?: string
  /** Y-axis domain (hidden) — widen it if your deltas exceed the default. */
  domain?: [number, number]
  valueFormatter?: (n: number) => string
} = {}) {
  return (
    <ChartContainer config={config} className="min-h-[240px] w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis hide domain={domain} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={valueFormatter ? (v) => valueFormatter(Number(v)) : undefined}
            />
          }
        />
        <Bar dataKey={dataKey} radius={4}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={
                Number(entry[dataKey]) >= 0
                  ? "var(--color-positive)"
                  : "var(--color-negative)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
