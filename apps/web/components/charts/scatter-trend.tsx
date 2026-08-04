"use client"

import { CartesianGrid, Line, ComposedChart, Scatter, XAxis, YAxis, ZAxis } from "recharts"

import { ScatterDot } from "./scatter-dot"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { x: 10, y: 22 },
  { x: 20, y: 30 },
  { x: 30, y: 38 },
  { x: 40, y: 55 },
  { x: 50, y: 52 },
  { x: 60, y: 70 },
  { x: 70, y: 68 },
  { x: 80, y: 88 },
]

const chartConfig = {
  points: { label: "Points", color: "var(--chart-1)" },
  trend: { label: "Trend", color: "var(--chart-2)" },
} satisfies ChartConfig

/** Ordinary least-squares fit — two endpoints are enough to draw the line. */
function ordinaryLeastSquares(points: { x: number; y: number }[]) {
  const n = points.length
  const sumX = points.reduce((s, d) => s + d.x, 0)
  const sumY = points.reduce((s, d) => s + d.y, 0)
  const sumXY = points.reduce((s, d) => s + d.x * d.y, 0)
  const sumXX = points.reduce((s, d) => s + d.x * d.x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

export function ChartScatterTrend({
  data = chartData,
  config = chartConfig,
  xDomain = [0, 90],
  yDomain = [0, 100],
}: {
  data?: { x: number; y: number }[]
  config?: ChartConfig
  xDomain?: [number, number]
  yDomain?: [number, number]
} = {}) {
  const { slope, intercept } = ordinaryLeastSquares(data)
  const xs = data.map((d) => d.x)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const trendData = [
    { x: minX, trend: intercept + slope * minX },
    { x: maxX, trend: intercept + slope * maxX },
  ]

  return (
    <ChartContainer config={config} className="min-h-[260px] w-full">
      <ComposedChart accessibilityLayer margin={{ left: 12, right: 12 }}>
        <CartesianGrid />
        <XAxis type="number" dataKey="x" tickLine={false} axisLine={false} domain={xDomain} />
        <YAxis type="number" tickLine={false} axisLine={false} domain={yDomain} />
        <ZAxis range={[90, 90]} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Scatter
          name="points"
          data={data}
          fill="var(--color-points)"
          dataKey="y"
          shape={<ScatterDot />}
          activeShape={<ScatterDot active />}
        />
        <Line
          name="trend"
          data={trendData}
          dataKey="trend"
          type="linear"
          stroke="var(--color-trend)"
          strokeWidth={2}
          dot={false}
          legendType="line"
        />
      </ComposedChart>
    </ChartContainer>
  )
}
