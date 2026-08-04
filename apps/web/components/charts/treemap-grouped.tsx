"use client"

import { Treemap } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { TreemapTile } from "./treemap-tile"

export type TreemapNode = {
  name: string
  size?: number
  children?: TreemapNode[]
}

const chartData: TreemapNode[] = [
  {
    name: "root",
    children: [
      {
        name: "Americas",
        children: [
          { name: "US", size: 900 },
          { name: "Canada", size: 320 },
          { name: "Brazil", size: 410 },
        ],
      },
      {
        name: "EMEA",
        children: [
          { name: "UK", size: 500 },
          { name: "Germany", size: 480 },
          { name: "France", size: 360 },
        ],
      },
      {
        name: "APAC",
        children: [
          { name: "Japan", size: 420 },
          { name: "Australia", size: 280 },
          { name: "India", size: 390 },
        ],
      },
    ],
  },
]

const chartConfig = {
  size: { label: "Size", color: "var(--chart-1)" },
} satisfies ChartConfig

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

function GroupContent(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  size?: number
  depth?: number
  index?: number
}) {
  const index = props.index ?? 0
  return (
    <TreemapTile
      {...props}
      fill={COLORS[index % COLORS.length]}
      value={props.size?.toLocaleString()}
      seam="var(--card)"
    />
  )
}

export function ChartTreemapGrouped({
  data = chartData,
  config = chartConfig,
}: {
  data?: TreemapNode[]
  config?: ChartConfig
} = {}) {
  return (
    <ChartContainer config={config} className="h-[280px] w-full aspect-auto">
      <Treemap
        data={data}
        dataKey="size"
        nameKey="name"
        content={<GroupContent />}
        isAnimationActive={false}
      />
    </ChartContainer>
  )
}
