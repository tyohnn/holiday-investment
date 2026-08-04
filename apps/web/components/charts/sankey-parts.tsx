"use client"

import * as React from "react"
import type { LinkProps, NodeProps } from "recharts/types/chart/Sankey"

/**
 * Shared Sankey node and link.
 *
 * Recharts' defaults draw an unlabelled bar and a flat translucent ribbon, so
 * a flow diagram ends up unreadable — you cannot tell which stage is which.
 * These render labelled nodes, source-to-target gradient ribbons, and a
 * hover that isolates everything touching one stage.
 */

/** Stage colours, indexed by the node's column. */
export const SANKEY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

/** Columns arrive in sequence, so the diagram reads left to right. */
export const SANKEY_STAGGER_MS = 70
/**
 * Ribbons at rest. Guidance for flow diagrams is 0.4–0.6, and it wants to sit
 * at the top of that: node bars are drawn at full saturation, so a fainter
 * ribbon reads as empty next to one and the bar looks like it overhangs.
 */
const LINK_OPACITY = 0.6
const LINK_OPACITY_ACTIVE = 0.75
const LINK_OPACITY_MUTED = 0.08

export function sankeyColor(depth: number, colors = SANKEY_COLORS) {
  return colors[depth % colors.length]
}

export type SankeyHover = {
  activeNode: string | null
  onActivate: (name: string | null) => void
}

/**
 * Recharts injects the geometry props when it clones these elements, so they
 * are optional here — the call site only passes the configuration.
 */
export function SankeyNodeShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
  colors = SANKEY_COLORS,
  activeNode,
  onActivate,
  showValue = true,
  nodeStroke,
}: Partial<NodeProps> & {
  colors?: string[]
  showValue?: boolean
  /** Outline on the node bar, for variants that lead with it. */
  nodeStroke?: string
} & Partial<SankeyHover>) {
  if (!payload) return <g />
  const depth = payload.depth ?? 0
  const fill = sankeyColor(depth, colors)
  // Always to the right of the bar. Variants leave right margin for the last
  // column; anchoring the final column inward instead would drop its label on
  // top of its own incoming ribbons.
  const labelX = x + width + 8
  const faded = activeNode != null && activeNode !== payload.name
  const centerY = y + height / 2
  const hasValue = showValue && height >= 26
  // Two lines have to straddle the node centre. Placing each independently
  // pushes the pair as a whole below it.
  const nameY = hasValue ? centerY - 6 : centerY
  const valueY = centerY + 8

  return (
    <g
      className="[transform-box:fill-box] [transform-origin:center] animate-in fade-in zoom-in-50 fill-mode-backwards duration-[500ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none"
      style={{ animationDelay: `${depth * SANKEY_STAGGER_MS}ms` }}
    >
      <g
        onMouseEnter={() => onActivate?.(payload.name)}
        onMouseLeave={() => onActivate?.(null)}
        className="cursor-pointer transition-opacity duration-150 ease-out motion-reduce:transition-none"
        opacity={faded ? 0.45 : 1}
      >
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={Math.min(4, width / 2)}
          fill={fill}
          fillOpacity={0.9}
          {...(nodeStroke ? { stroke: nodeStroke, strokeWidth: 2 } : {})}
        />
        <text
          x={labelX}
          y={nameY}
          dominantBaseline="middle"
          // Middle columns sit over their own ribbons; the outline keeps the
          // label readable without a backing plate.
          stroke="var(--card)"
          strokeWidth={3}
          className="pointer-events-none fill-foreground text-[12px] font-medium [paint-order:stroke]"
        >
          {payload.name}
        </text>
        {hasValue && (
          <text
            x={labelX}
            y={valueY}
            dominantBaseline="middle"
            stroke="var(--card)"
            strokeWidth={3}
            className="pointer-events-none fill-muted-foreground text-[11px] tabular-nums [paint-order:stroke]"
          >
            {payload.value?.toLocaleString?.() ?? payload.value}
          </text>
        )}
      </g>
    </g>
  )
}

export function SankeyLinkShape({
  sourceX = 0,
  targetX = 0,
  sourceY = 0,
  targetY = 0,
  sourceControlX = 0,
  targetControlX = 0,
  linkWidth = 0,
  index = 0,
  payload,
  colors = SANKEY_COLORS,
  activeNode,
}: Partial<LinkProps> & { colors?: string[] } & Partial<
    Pick<SankeyHover, "activeNode">
  >) {
  const uid = React.useId()
  const gradientId = `sankey-link-${uid}-${index}`
  if (!payload) return <g />

  const from = sankeyColor(payload.source.depth ?? 0, colors)
  const to = sankeyColor(payload.target.depth ?? 0, colors)

  const touchesActive =
    activeNode != null &&
    (payload.source.name === activeNode || payload.target.name === activeNode)
  const opacity =
    activeNode == null
      ? LINK_OPACITY
      : touchesActive
        ? LINK_OPACITY_ACTIVE
        : LINK_OPACITY_MUTED

  return (
    <g
      className="animate-in fade-in fill-mode-backwards duration-[600ms] ease-out motion-reduce:animate-none"
      style={{
        animationDelay: `${((payload.source.depth ?? 0) + 1) * SANKEY_STAGGER_MS}ms`,
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <path
        d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={linkWidth}
        strokeOpacity={opacity}
        className="pointer-events-none transition-[stroke-opacity] duration-200 ease-out motion-reduce:transition-none"
      />
    </g>
  )
}
