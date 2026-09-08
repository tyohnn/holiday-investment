import { GROUP_CHROME_PX, groupInnerHeightPx, plainInnerHeightPx } from './grid';
import type { ResearchGroup, ResearchInnerMode } from './types';

export const FLOW_GROUP_WIDTH = 880;
export const FLOW_GROUP_GAP_X = 220;
export const FLOW_GROUP_GAP_Y = 180;
export const FLOW_COLS = 2;
export const FLOW_INNER_PAD_X = 8;
export const FLOW_CAMERA_MS = 650;

export type FlowGroupBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function flowInnerWidth(): number {
  return FLOW_GROUP_WIDTH - FLOW_INNER_PAD_X * 2;
}

export function flowGroupSize(
  group: Pick<ResearchGroup, 'widgets'>,
  mode: ResearchInnerMode,
): { width: number; height: number } {
  const inner =
    mode === 'rgl' ? groupInnerHeightPx(group.widgets) : plainInnerHeightPx(group.widgets.length);
  return { width: FLOW_GROUP_WIDTH, height: GROUP_CHROME_PX + inner };
}

/** 그룹 배열 순서가 목차. 월드는 2열 팩. */
export function packFlowGroups(
  groups: readonly ResearchGroup[],
  mode: ResearchInnerMode,
): FlowGroupBox[] {
  const sizes = groups.map((group) => flowGroupSize(group, mode));
  const rowHeights: number[] = [];
  for (let index = 0; index < sizes.length; index += FLOW_COLS) {
    const row = sizes.slice(index, index + FLOW_COLS);
    rowHeights.push(Math.max(...row.map((size) => size.height)));
  }
  return groups.map((group, index) => {
    const col = index % FLOW_COLS;
    const row = Math.floor(index / FLOW_COLS);
    const y = rowHeights.slice(0, row).reduce((sum, height) => sum + height + FLOW_GROUP_GAP_Y, 0);
    return {
      id: group.id,
      x: col * (FLOW_GROUP_WIDTH + FLOW_GROUP_GAP_X),
      y,
      width: sizes[index]?.width ?? FLOW_GROUP_WIDTH,
      height: sizes[index]?.height ?? GROUP_CHROME_PX,
    };
  });
}

export function boxCenter(box: FlowGroupBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
