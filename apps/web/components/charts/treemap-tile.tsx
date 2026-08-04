"use client"

/**
 * Shared treemap tile.
 *
 * Recharts' own treemap tween animates width/height, which lays out and paints
 * every frame, so variants keep `isAnimationActive={false}` and let the tile
 * animate transform and opacity instead.
 */

/** Tiles cascade in rather than all landing at once. */
export const TREEMAP_STAGGER_MS = 45
/** Below these a tile can't hold a label without clipping it. */
export const MIN_LABEL_WIDTH = 56
export const MIN_LABEL_HEIGHT = 30

export type TreemapTileProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  index?: number
  fill?: string
  fillOpacity?: number
  /** Corner rounding. */
  radius?: number
  /** Inset on every side, so tiles read as separated by empty space. */
  gap?: number
  /** Seam colour between adjacent tiles. Omit for gap-based separation. */
  seam?: string
  name?: string
  /** Rendered under the name when the tile is tall enough. */
  value?: string | number
  /** Fade this tile back — used by the highlight variant. */
  dimmed?: boolean
  /** Lift and brighten on hover. */
  interactive?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  /**
   * Recharts' node children. Branch nodes span the whole area their leaves sit
   * in, so drawing one hides everything underneath. Depth is not a reliable
   * test — the wrapper is depth 1 in some variants and depth 2 in others.
   */
  children?: readonly unknown[] | null
}

export function TreemapTile({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  fill,
  fillOpacity,
  radius = 6,
  gap = 0,
  seam,
  name,
  value,
  dimmed = false,
  interactive = true,
  onMouseEnter,
  onMouseLeave,
  children,
}: TreemapTileProps) {
  const isLeaf = children == null || children.length === 0
  const w = width - gap * 2
  const h = height - gap * 2
  if (!isLeaf || w <= 0 || h <= 0) return <g />

  const left = x + gap
  const top = y + gap
  const showLabel = w >= MIN_LABEL_WIDTH && h >= MIN_LABEL_HEIGHT
  const showValue = value != null && showLabel && h >= MIN_LABEL_HEIGHT + 20

  return (
    // Entry and hover own separate layers — one element cannot run an
    // animation and a transition against the same property.
    <g
      // Growing from each tile's own top-left corner reads as the layout
      // filling itself in, rather than everything pulsing in place.
      className="[transform-box:fill-box] [transform-origin:top_left] animate-in fade-in zoom-in-75 fill-mode-backwards duration-[500ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none"
      style={{ animationDelay: `${index * TREEMAP_STAGGER_MS}ms` }}
    >
      <g
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        // Tailwind's scale-* sets the CSS `scale` property, not `transform`,
        // so `scale` is what has to be transitioned.
        className={[
          "[transform-box:fill-box] [transform-origin:center] transition-[scale,filter,opacity] duration-150 ease-out motion-reduce:transition-none",
          interactive
            ? "hover:brightness-110 motion-safe:hover:scale-[1.015]"
            : "",
          onMouseEnter ? "cursor-pointer" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        opacity={dimmed ? 0.3 : 1}
      >
        <rect
          x={left}
          y={top}
          width={w}
          height={h}
          rx={radius}
          fill={fill}
          fillOpacity={fillOpacity}
          {...(seam ? { stroke: seam, strokeWidth: 3 } : {})}
        />
        {showLabel && (
          <text
            x={left + 12}
            y={top + 22}
            className="pointer-events-none fill-white text-[13px] font-medium [paint-order:stroke]"
            // Outlines the glyphs so the label survives any tile colour.
            stroke="oklch(0 0 0 / 0.35)"
            strokeWidth={3}
          >
            {name}
          </text>
        )}
        {showValue && (
          <text
            x={left + 12}
            y={top + 40}
            className="pointer-events-none fill-white/80 text-[12px] tabular-nums [paint-order:stroke]"
            stroke="oklch(0 0 0 / 0.35)"
            strokeWidth={3}
          >
            {value}
          </text>
        )}
      </g>
    </g>
  )
}
