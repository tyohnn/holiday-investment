"use client"

import * as React from "react"
import { Sankey } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { SankeyLinkShape, SankeyNodeShape } from "./sankey-parts"

export type SankeyData = {
  nodes: { name: string }[]
  links: { source: number; target: number; value: number }[]
}

const defaultData: SankeyData = {
  nodes: [
    { name: "Visit" },
    { name: "Sign up" },
    { name: "Activate" },
    { name: "Paid" },
    { name: "Churn" },
  ],
  links: [
    { source: 0, target: 1, value: 420 },
    { source: 0, target: 4, value: 180 },
    { source: 1, target: 2, value: 310 },
    { source: 1, target: 4, value: 110 },
    { source: 2, target: 3, value: 210 },
    { source: 2, target: 4, value: 100 },
  ],
}

const defaultChartConfig = {
  value: { label: "Flow", color: "var(--chart-1)" },
} satisfies ChartConfig

export function ChartSankeyBasic({
  data = defaultData,
  config = defaultChartConfig,
}: {
  data?: SankeyData
  config?: ChartConfig
} = {}) {
  const [activeNode, setActiveNode] = React.useState<string | null>(null)

  return (
    <ChartContainer config={config} className="h-[280px] w-full aspect-auto">
      <Sankey
        data={data}
        nodePadding={24}
        nodeWidth={12}
        linkCurvature={0.5}
        // Room for the stage labels sitting outside the node bars.
        margin={{ left: 16, right: 96, top: 16, bottom: 16 }}
        node={
          <SankeyNodeShape
            activeNode={activeNode}
            onActivate={setActiveNode}
          />
        }
        link={<SankeyLinkShape activeNode={activeNode} />}
      >
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
      </Sankey>
    </ChartContainer>
  )
}
