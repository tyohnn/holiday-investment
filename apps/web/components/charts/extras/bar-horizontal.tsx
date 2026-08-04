"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { channel: "Organic", leads: 420 },
  { channel: "Paid", leads: 310 },
  { channel: "Referral", leads: 186 },
  { channel: "Partner", leads: 142 },
  { channel: "Direct", leads: 98 },
]

const chartConfig = {
  leads: {
    label: "Leads",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

/**
 * Bars run left-to-right, category labels on the Y axis — the variant to
 * reach for when X-axis labels (e.g. long Korean category names) would
 * otherwise collide.
 */
export function ChartBarHorizontal({
  data = chartData,
  config = chartConfig,
  categoryKey = "channel",
  dataKey = "leads",
  categoryWidth = 72,
  valueFormatter,
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  categoryKey?: string
  dataKey?: string
  /** Reserved width for the Y-axis category column — widen for long labels. */
  categoryWidth?: number
  valueFormatter?: (n: number) => string
} = {}) {
  return (
    <ChartContainer config={config} className="min-h-[260px] w-full">
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 12 }}
      >
        <CartesianGrid horizontal={false} />
        <YAxis
          dataKey={categoryKey}
          type="category"
          tickLine={false}
          axisLine={false}
          width={categoryWidth}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={valueFormatter ? (v) => valueFormatter(Number(v)) : undefined}
            />
          }
        />
        <Bar
          dataKey={dataKey}
          fill={`var(--color-${dataKey})`}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}
