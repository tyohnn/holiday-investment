"use client"

import { Cell, Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
  { browser: "firefox", visitors: 187 },
  { browser: "edge", visitors: 173 },
  { browser: "other", visitors: 90 },
]

const chartConfig = {
  visitors: { label: "Visitors" },
  chrome: { label: "Chrome", color: "var(--chart-1)" },
  safari: { label: "Safari", color: "var(--chart-2)" },
  firefox: { label: "Firefox", color: "var(--chart-3)" },
  edge: { label: "Edge", color: "var(--chart-4)" },
  other: { label: "Other", color: "var(--chart-5)" },
} satisfies ChartConfig

/** Cycles through --chart-1..5 for slices beyond the config's own colors. */
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function ChartPieDonut({
  data = chartData,
  config = chartConfig,
  dataKey = "visitors",
  nameKey = "browser",
  innerRadius = 60,
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  dataKey?: string
  nameKey?: string
  innerRadius?: number
} = {}) {
  return (
    <ChartContainer
      config={config}
      className="mx-auto aspect-square max-h-[250px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          innerRadius={innerRadius}
        >
          {data.map((entry, i) => {
            const key = String(entry[nameKey])
            const configured = config[key]?.color
            return (
              <Cell key={key} fill={configured ?? CHART_COLORS[i % CHART_COLORS.length]} />
            )
          })}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
