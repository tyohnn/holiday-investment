"use client"

import * as React from "react"

import { cn } from "@/lib/cn"

const defaultLabels = ["Revenue", "Users", "Sessions", "Churn", "NPS"]

/** Symmetric correlation matrix (−1…1). */
const defaultMatrix: number[][] = [
  [1, 0.72, 0.65, -0.41, 0.38],
  [0.72, 1, 0.88, -0.52, 0.45],
  [0.65, 0.88, 1, -0.48, 0.4],
  [-0.41, -0.52, -0.48, 1, -0.61],
  [0.38, 0.45, 0.4, -0.61, 1],
]

function corrColor(v: number) {
  if (v >= 0) {
    const t = Math.round(v * 100)
    return `color-mix(in oklch, var(--chart-1) ${t}%, var(--muted))`
  }
  const t = Math.round(Math.abs(v) * 100)
  return `color-mix(in oklch, var(--chart-5) ${t}%, var(--muted))`
}

/**
 * Correlation matrices are cell grids, not cartesian series. Recharts Scatter
 * can approximate this, but a token-styled grid is clearer for docs demos.
 */
export function ChartHeatmapCorrelation({
  labels = defaultLabels,
  matrix = defaultMatrix,
}: {
  labels?: string[]
  /** Square matrix, same length/order as `labels`. */
  matrix?: number[][]
} = {}) {
  const [hovered, setHovered] = React.useState<[number, number] | null>(null)

  return (
    <div className="overflow-x-auto">
      <table
        className="border-separate border-spacing-1 text-xs"
        onMouseLeave={() => setHovered(null)}
      >
        <thead>
          <tr>
            <th className="w-16" />
            {labels.map((l, j) => (
              <th
                key={l}
                className={cn(
                  "px-1 pb-1 text-center font-medium transition-colors duration-150",
                  hovered?.[1] === j
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={labels[i]}>
              <th
                className={cn(
                  "pr-2 text-left font-medium transition-colors duration-150",
                  hovered?.[0] === i
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {labels[i]}
              </th>
              {row.map((v, j) => {
                // A matrix is read by crossing a row with a column, so the
                // whole cross stays lit rather than just the cell.
                const inCross =
                  hovered != null && (hovered[0] === i || hovered[1] === j)
                const isCell = hovered?.[0] === i && hovered?.[1] === j
                return (
                  <td key={`${i}-${j}`}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`${labels[i]} by ${labels[j]}: ${v.toFixed(2)}`}
                      onMouseEnter={() => setHovered([i, j])}
                      onFocus={() => setHovered([i, j])}
                      onBlur={() => setHovered(null)}
                      style={{
                        background: corrColor(v),
                        animationDelay: `${(i + j) * 35}ms`,
                      }}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-md text-[10px] font-medium tabular-nums text-foreground outline-none",
                        "animate-in fade-in zoom-in-90 fill-mode-backwards duration-[400ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none",
                        "transition-[scale,opacity,box-shadow] duration-150 ease-out motion-reduce:transition-none",
                        hovered != null && !inCross && "opacity-40",
                        isCell &&
                          "scale-105 ring-2 ring-foreground/60 motion-reduce:scale-100",
                        "focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                    >
                      {v.toFixed(2)}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
