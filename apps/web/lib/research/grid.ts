/** 바깥 보드 RGL — 칸 하나가 그룹 */
export const OUTER_GRID = {
  cols: 12,
  rowHeight: 36,
  margin: [16, 16] as const,
} as const;

/** 그룹 안 nested RGL — 칸 하나가 위젯 */
export const INNER_GRID = {
  cols: 12,
  rowHeight: 32,
  margin: [8, 8] as const,
} as const;

/** 그룹 헤더 + 테두리 + body padding(py-2×2) */
export const GROUP_CHROME_PX = 72;

/** 빈 그룹에 드롭할 자리 */
export const EMPTY_INNER_MIN_PX = INNER_GRID.rowHeight * 3 + INNER_GRID.margin[1] * 2;

/**
 * RGL 컨테이너 높이.
 * `nbRow * rowHeight + (nbRow - 1) * marginY + paddingY * 2`
 * containerPadding 기본값은 margin.
 */
export function rglHeightPx(
  nbRow: number,
  rowHeight: number,
  marginY: number,
  paddingY = marginY,
): number {
  if (nbRow <= 0) return paddingY * 2;
  return nbRow * rowHeight + (nbRow - 1) * marginY + paddingY * 2;
}

export function innerContentBottom(widgets: readonly { layout: { y: number; h: number } }[]): number {
  return widgets.reduce((max, widget) => Math.max(max, widget.layout.y + widget.layout.h), 0);
}

export function groupHeightFromWidgets(
  widgets: readonly { layout: { y: number; h: number } }[],
): number {
  const bottom = innerContentBottom(widgets);
  const innerPx =
    bottom === 0
      ? EMPTY_INNER_MIN_PX
      : rglHeightPx(bottom, INNER_GRID.rowHeight, INNER_GRID.margin[1]);
  return pxToOuterUnits(GROUP_CHROME_PX + innerPx);
}

function pxToOuterUnits(px: number): number {
  const step = OUTER_GRID.rowHeight + OUTER_GRID.margin[1];
  return Math.max(1, Math.ceil((px + OUTER_GRID.margin[1]) / step));
}
