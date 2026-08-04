"use client"

import { Treemap } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { TreemapTile } from "./treemap-tile"

export type TreemapLeaf = { name: string; size: number; fill?: string }

const chartData: { name: string; children: TreemapLeaf[] }[] = [
  {
    name: "Product",
    children: [
      { name: "Electronics", size: 1200, fill: "var(--chart-1)" },
      { name: "Apparel", size: 800, fill: "var(--chart-2)" },
      { name: "Home", size: 600, fill: "var(--chart-3)" },
      { name: "Beauty", size: 400, fill: "var(--chart-4)" },
    ],
  },
]

const chartConfig = {
  size: { label: "Size", color: "var(--chart-1)" },
} satisfies ChartConfig

/** Cycles through --chart-1..5 when a leaf has no explicit `fill`. */
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function BasicContent(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  size?: number
  fill?: string
  index?: number
  children?: readonly unknown[] | null
}) {
  return (
    <TreemapTile
      {...props}
      fill={props.fill ?? CHART_COLORS[(props.index ?? 0) % CHART_COLORS.length]}
      value={props.size?.toLocaleString()}
      seam="var(--card)"
    />
  )
}

export function ChartTreemapBasic({
  data = chartData,
  config = chartConfig,
}: {
  data?: { name: string; children: TreemapLeaf[] }[]
  config?: ChartConfig
} = {}) {
  return (
    <ChartContainer
      config={config}
      className="h-[260px] w-full aspect-auto"
    >
      <Treemap
        data={data}
        dataKey="size"
        nameKey="name"
        // Recharts' own tween animates width/height, which lays out and
        // paints every frame. The node does its own transform/opacity one.
        isAnimationActive={false}
        content={<BasicContent />}
      >
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
      </Treemap>
    </ChartContainer>
  )
}
