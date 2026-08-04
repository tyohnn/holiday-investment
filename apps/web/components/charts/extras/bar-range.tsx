"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { day: "Mon", range: [18, 42] as [number, number] },
  { day: "Tue", range: [22, 48] as [number, number] },
  { day: "Wed", range: [16, 39] as [number, number] },
  { day: "Thu", range: [25, 52] as [number, number] },
  { day: "Fri", range: [28, 55] as [number, number] },
  { day: "Sat", range: [20, 44] as [number, number] },
  { day: "Sun", range: [14, 36] as [number, number] },
]

const chartConfig = {
  range: {
    label: "Temp °C",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

export function ChartBarRange({
  data = chartData,
  config = chartConfig,
  xKey = "day",
  dataKey = "range",
  domain = [0, 60],
  valueFormatter,
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  xKey?: string
  /** `[min, max]`-tuple field, e.g. `[18, 42]`. */
  dataKey?: string
  /** Y-axis domain (hidden) — widen it if your ranges exceed the default. */
  domain?: [number, number]
  /** Value is the raw `[min, max]` tuple — format both ends yourself. */
  valueFormatter?: (range: [number, number]) => string
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
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={
                valueFormatter
                  ? (v) => valueFormatter(v as unknown as [number, number])
                  : undefined
              }
            />
          }
        />
        <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
