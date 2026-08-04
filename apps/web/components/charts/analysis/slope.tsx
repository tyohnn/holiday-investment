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

/** Two-period slope: each series connects start → end. */
const chartData = [
  { period: "2024", alpha: 42, beta: 65, gamma: 28, delta: 55 },
  { period: "2025", alpha: 58, beta: 48, gamma: 51, delta: 62 },
]

const chartConfig = {
  alpha: { label: "Alpha", color: "var(--chart-1)" },
  beta: { label: "Beta", color: "var(--chart-2)" },
  gamma: { label: "Gamma", color: "var(--chart-3)" },
  delta: { label: "Delta", color: "var(--chart-4)" },
} satisfies ChartConfig

export function ChartSlope({
  data = chartData,
  config = chartConfig,
  xKey = "period",
  series,
  valueFormatter,
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  xKey?: string
  /** Defaults to every key in `config` — a slope chart is just N series. */
  series?: string[]
  valueFormatter?: (n: number) => string
} = {}) {
  const keys = series ?? Object.keys(config)
  return (
    <ChartContainer config={config} className="min-h-[240px] w-full">
      <LineChart
        accessibilityLayer
        data={data}
        margin={{ left: 12, right: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={valueFormatter} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={valueFormatter ? (v) => valueFormatter(Number(v)) : undefined}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((key) => (
          <Line
            key={key}
            type="linear"
            dataKey={key}
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
