"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { quarter: "Q1", productA: 186, productB: 80, productC: 120 },
  { quarter: "Q2", productA: 305, productB: 200, productC: 160 },
  { quarter: "Q3", productA: 237, productB: 120, productC: 190 },
  { quarter: "Q4", productA: 273, productB: 190, productC: 140 },
]

const chartConfig = {
  productA: { label: "Product A", color: "var(--chart-1)" },
  productB: { label: "Product B", color: "var(--chart-2)" },
  productC: { label: "Product C", color: "var(--chart-3)" },
} satisfies ChartConfig

export function ChartBarGrouped({
  data = chartData,
  config = chartConfig,
  xKey = "quarter",
  series = ["productA", "productB", "productC"],
  valueFormatter,
}: {
  data?: Record<string, unknown>[]
  config?: ChartConfig
  xKey?: string
  series?: string[]
  valueFormatter?: (n: number) => string
} = {}) {
  return (
    <ChartContainer config={config} className="min-h-[220px] w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={valueFormatter ? (v) => valueFormatter(Number(v)) : undefined}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((key) => (
          <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={3} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
