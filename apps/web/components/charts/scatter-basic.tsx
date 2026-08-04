"use client"

import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"

import { ScatterDot } from "./scatter-dot"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { x: 10, y: 30 },
  { x: 25, y: 50 },
  { x: 40, y: 35 },
  { x: 55, y: 70 },
  { x: 70, y: 55 },
  { x: 85, y: 90 },
  { x: 35, y: 80 },
  { x: 60, y: 40 },
]

const chartConfig = {
  points: { label: "Points", color: "var(--chart-1)" },
} satisfies ChartConfig

export function ChartScatterBasic({
  data = chartData,
  config = chartConfig,
  xKey = "x",
  yKey = "y",
  seriesKey = "points",
  xValueFormatter,
  yValueFormatter,
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  xKey?: string
  yKey?: string
  /** Config key that supplies the fill color for `--color-<seriesKey>`. */
  seriesKey?: string
  xValueFormatter?: (n: number) => string
  yValueFormatter?: (n: number) => string
} = {}) {
  return (
    <ChartContainer config={config} className="min-h-[240px] w-full">
      <ScatterChart accessibilityLayer margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
        <CartesianGrid />
        <XAxis type="number" dataKey={xKey} name={xKey} tickLine={false} axisLine={false} tickFormatter={xValueFormatter} />
        <YAxis type="number" dataKey={yKey} name={yKey} tickLine={false} axisLine={false} tickFormatter={yValueFormatter} />
        <ZAxis range={[80, 80]} />
        <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent hideLabel />} />
        <Scatter
          data={data}
          fill={`var(--color-${seriesKey})`}
          name={seriesKey}
          shape={<ScatterDot />}
          activeShape={<ScatterDot active />}
        />
      </ScatterChart>
    </ChartContainer>
  )
}
