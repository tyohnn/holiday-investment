"use client"

/**
 * Shared scatter dot with a hover buffer.
 *
 * Scatter markers are only a few pixels wide, so activating one means landing
 * on it precisely. Each dot carries an invisible circle of `hoverRadius`, which
 * is what recharts hit-tests against — the pointer gets caught on approach
 * instead of having to hit the marker itself.
 */

/** How close (px) the pointer has to get before a dot takes it. */
export const SCATTER_HOVER_RADIUS = 28

/** Radius of the card-coloured disc that breaks a crosshair behind the dot. */
const HALO_PADDING = 3.5

export type ScatterDotProps = {
  cx?: number
  cy?: number
  /** Recharts' abstract point size — circle area in px². Driven by ZAxis range. */
  size?: number
  fill?: string
  fillOpacity?: number
  hoverRadius?: number
  /** Draw a card-coloured disc under the dot so crosshairs break around it. */
  halo?: boolean
  /** Grow the marker to show it captured the pointer. */
  active?: boolean
}

/** Recharts draws the default circle symbol with `size` as its area. */
export function scatterDotRadius(size: number | undefined): number {
  return Math.sqrt((size ?? 80) / Math.PI)
}

export function ScatterDot({
  cx,
  cy,
  size,
  fill,
  fillOpacity,
  hoverRadius = SCATTER_HOVER_RADIUS,
  halo = false,
  active = false,
}: ScatterDotProps) {
  // Points outside the domain have no coordinate; recharts skips those.
  if (cx == null || cy == null) return <g />

  const radius = scatterDotRadius(size)
  const drawn = active ? radius * 1.35 : radius
  // Bubbles can already be wider than the buffer — never shrink the hit area.
  const buffer = Math.max(hoverRadius, drawn)

  return (
    <g>
      <circle cx={cx} cy={cy} r={buffer} fill="transparent" />
      {halo && active && (
        <circle cx={cx} cy={cy} r={drawn + HALO_PADDING} className="fill-card" />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={drawn}
        fill={fill}
        fillOpacity={fillOpacity}
      />
    </g>
  )
}
