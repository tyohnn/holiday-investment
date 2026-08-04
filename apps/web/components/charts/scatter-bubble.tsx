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
  { x: 20, y: 40, z: 120, name: "Alpha" },
  { x: 35, y: 60, z: 200, name: "Beta" },
  { x: 50, y: 35, z: 80, name: "Gamma" },
  { x: 65, y: 75, z: 260, name: "Delta" },
  { x: 80, y: 55, z: 150, name: "Epsilon" },
  { x: 42, y: 82, z: 180, name: "Zeta" },
]

const chartConfig = {
  bubble: { label: "Bubble", color: "var(--chart-1)" },
} satisfies ChartConfig

export function ChartScatterBubble({
  data = chartData,
  config = chartConfig,
  xKey = "x",
  yKey = "y",
  zKey = "z",
  nameKey = "name",
  seriesKey = "bubble",
  zRange = [60, 400],
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  xKey?: string
  yKey?: string
  /** Bubble-size dimension. */
  zKey?: string
  nameKey?: string
  /** Config key that supplies the fill color for `--color-<seriesKey>`. */
  seriesKey?: string
  zRange?: [number, number]
} = {}) {
  return (
    <ChartContainer config={config} className="min-h-[260px] w-full">
      <ScatterChart accessibilityLayer margin={{ left: 12, right: 12 }}>
        <CartesianGrid />
        <XAxis type="number" dataKey={xKey} name={xKey} tickLine={false} axisLine={false} />
        <YAxis type="number" dataKey={yKey} name={yKey} tickLine={false} axisLine={false} />
        <ZAxis type="number" dataKey={zKey} range={zRange} name={zKey} />
        <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} />} />
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
