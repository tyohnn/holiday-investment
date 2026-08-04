"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  ReferenceArea,
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

export type BulletRow = {
  metric: string
  /** Each KPI carries its own scale — a shared one flattens the tight ones. */
  min: number
  poor: number
  ok: number
  max: number
  actual: number
  target: number
}

const chartData: BulletRow[] = [
  { metric: "Revenue", min: 0, poor: 60, ok: 85, max: 100, actual: 78, target: 90 },
  { metric: "NPS", min: 0, poor: 40, ok: 70, max: 100, actual: 62, target: 75 },
  { metric: "Uptime", min: 98.5, poor: 99, ok: 99.5, max: 100, actual: 99.4, target: 99.9 },
]

const chartConfig = {
  actual: { label: "Actual", color: "var(--chart-1)" },
  target: { label: "Target", color: "var(--foreground)" },
} satisfies ChartConfig

/**
 * Qualitative bands are context, not categories, so they step through one
 * neutral ramp. Hue-coding them competes with the measure bar for attention.
 */
const BANDS = [
  "color-mix(in oklch, var(--muted-foreground) 10%, transparent)",
  "color-mix(in oklch, var(--muted-foreground) 18%, transparent)",
  "color-mix(in oklch, var(--muted-foreground) 28%, transparent)",
]

const defaultFmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

/**
 * Recharts has no bullet mark. ReferenceArea draws the qualitative bands, a
 * horizontal Bar the measure, and ReferenceLine the target.
 */
export function ChartBullet({
  data = chartData,
  config = chartConfig,
  valueFormatter = defaultFmt,
}: {
  data?: BulletRow[]
  config?: ChartConfig
  valueFormatter?: (n: number) => string
} = {}) {
  const [active, setActive] = React.useState<string | null>(null)

  return (
    <div className="space-y-5">
      {data.map((row, index) => {
        const hit = row.actual >= row.target
        return (
          <div
            key={row.metric}
            className="space-y-1.5"
            onMouseEnter={() => setActive(row.metric)}
            onMouseLeave={() => setActive(null)}
          >
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{row.metric}</span>
              <span className="tabular-nums text-muted-foreground">
                <span
                  className={
                    hit ? "font-medium text-foreground" : "font-medium text-foreground"
                  }
                >
                  {valueFormatter(row.actual)}
                </span>
                {" / target "}
                {valueFormatter(row.target)}
              </span>
            </div>
            <ChartContainer
              config={config}
              className="h-8 w-full aspect-auto"
            >
              <BarChart
                accessibilityLayer
                layout="vertical"
                data={[row]}
                margin={{ left: 0, right: 0, top: 4, bottom: 4 }}
              >
                <XAxis type="number" domain={[row.min, row.max]} hide />
                <YAxis type="category" dataKey="metric" hide />
                {[
                  [row.min, row.poor],
                  [row.poor, row.ok],
                  [row.ok, row.max],
                ].map(([x1, x2], i) => (
                  <ReferenceArea
                    key={i}
                    x1={x1}
                    x2={x2}
                    fill={BANDS[i]}
                    fillOpacity={1}
                    ifOverflow="visible"
                  />
                ))}
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar
                  dataKey="actual"
                  barSize={10}
                  fill="var(--color-actual)"
                  radius={[0, 5, 5, 0]}
                  // Bars fill left to right, one row after the next.
                  animationBegin={index * 90}
                  animationDuration={650}
                  animationEasing="ease-out"
                />
                {/* The target is a tick, not a band — it reads as a goalpost
                    the measure either clears or falls short of. */}
                <ReferenceLine
                  x={row.target}
                  stroke="var(--color-target)"
                  strokeWidth={2}
                  ifOverflow="visible"
                />
              </BarChart>
            </ChartContainer>
            <div
              className={
                "flex justify-between text-[10px] tabular-nums text-muted-foreground transition-opacity duration-150 " +
                (active === row.metric ? "opacity-100" : "opacity-0")
              }
            >
              <span>{valueFormatter(row.min)}</span>
              <span>{valueFormatter(row.max)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
