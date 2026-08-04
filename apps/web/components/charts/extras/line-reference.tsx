"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { month: "Jan", sessions: 210 },
  { month: "Feb", sessions: 248 },
  { month: "Mar", sessions: 268 },
  { month: "Apr", sessions: 312 },
  { month: "May", sessions: 290 },
  { month: "Jun", sessions: 340 },
  { month: "Jul", sessions: 358 },
  { month: "Aug", sessions: 372 },
]

const chartConfig = {
  sessions: {
    label: "Sessions",
    color: "var(--chart-1)",
  },
  event: {
    label: "Launch window",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

export function ChartLineReference({
  data = chartData,
  config = chartConfig,
  xKey = "month",
  dataKey = "sessions",
  domain = [180, 400],
  /** Dashed horizontal target line — omit to skip it. */
  target = { value: 300, label: "Target" },
  /** Shaded x-range callout — omit to skip it. */
  highlight = { x1: "Mar", x2: "May" },
  /** Single-point callout — omit to skip it. */
  eventDot = { x: "Apr", y: 312, label: "Launch" },
  valueFormatter,
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  xKey?: string
  dataKey?: string
  domain?: [number, number]
  target?: { value: number; label: string } | null
  highlight?: { x1: string | number; x2: string | number } | null
  eventDot?: { x: string | number; y: number; label: string } | null
  valueFormatter?: (n: number) => string
} = {}) {
  return (
    <ChartContainer config={config} className="min-h-[260px] w-full">
      <LineChart
        accessibilityLayer
        data={data}
        margin={{ left: 12, right: 12, top: 8 }}
      >
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
              indicator="line"
              formatter={valueFormatter ? (v) => valueFormatter(Number(v)) : undefined}
            />
          }
        />
        {highlight ? (
          <ReferenceArea
            x1={highlight.x1}
            x2={highlight.x2}
            fill="var(--color-event)"
            fillOpacity={0.15}
            strokeOpacity={0}
          />
        ) : null}
        {target ? (
          <ReferenceLine
            y={target.value}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: target.label,
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 12,
            }}
          />
        ) : null}
        <Line
          dataKey={dataKey}
          type="monotone"
          stroke={`var(--color-${dataKey})`}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        {eventDot ? (
          <ReferenceDot
            x={eventDot.x}
            y={eventDot.y}
            r={6}
            fill="var(--color-event)"
            stroke="var(--background)"
            strokeWidth={2}
            label={{
              value: eventDot.label,
              position: "top",
              fill: "var(--foreground)",
              fontSize: 12,
            }}
          />
        ) : null}
      </LineChart>
    </ChartContainer>
  )
}
