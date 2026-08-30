import type {
  ResearchBoard,
  ResearchBoardTheme,
  ResearchGroup,
  ResearchWidget,
  ResearchWidgetKind,
  ResearchWidgetLayout,
} from './types';

const WIDGET_KINDS: readonly ResearchWidgetKind[] = ['chart', 'news', 'note', 'metric', 'link'];

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export function emptyBoard(
  theme: ResearchBoardTheme,
  title = '새 보드',
): ResearchBoard {
  const groupId = newId('group');
  return {
    slug: newId('board'),
    title,
    tagline: '',
    theme,
    groups: [
      {
        id: groupId,
        title: '새 그룹',
        summary: '',
        layout: { i: groupId, x: 0, y: 0, w: 6, h: 14, minW: 4, minH: 10 },
        widgets: [],
      },
    ],
  };
}

export function addGroup(board: ResearchBoard, title = '새 그룹'): ResearchBoard {
  const id = newId('group');
  const y = board.groups.reduce((max, group) => Math.max(max, group.layout.y + group.layout.h), 0);
  const group: ResearchGroup = {
    id,
    title,
    summary: '',
    layout: { i: id, x: 0, y, w: 6, h: 14, minW: 4, minH: 10 },
    widgets: [],
  };
  return { ...board, groups: [...board.groups, group] };
}

export function removeGroup(board: ResearchBoard, groupId: string): ResearchBoard {
  return { ...board, groups: board.groups.filter((group) => group.id !== groupId) };
}

export function renameGroup(
  board: ResearchBoard,
  groupId: string,
  patch: { title?: string; summary?: string },
): ResearchBoard {
  return {
    ...board,
    groups: board.groups.map((group) =>
      group.id === groupId ? { ...group, ...patch } : group,
    ),
  };
}

export function addNoteWidget(board: ResearchBoard, groupId: string): ResearchBoard {
  return {
    ...board,
    groups: board.groups.map((group) => {
      if (group.id !== groupId) return group;
      const id = newId('note');
      const y = group.widgets.reduce((max, widget) => Math.max(max, widget.layout.y + widget.layout.h), 0);
      const widget: ResearchWidget = {
        id,
        kind: 'note',
        title: '새 노트',
        layout: { i: id, x: 0, y, w: 6, h: 4, minW: 3, minH: 3 },
        body: '',
      };
      return { ...group, widgets: [...group.widgets, widget] };
    }),
  };
}

export function removeWidget(board: ResearchBoard, widgetId: string): ResearchBoard {
  return {
    ...board,
    groups: board.groups.map((group) => ({
      ...group,
      widgets: group.widgets.filter((widget) => widget.id !== widgetId),
    })),
  };
}

export function renameWidget(
  board: ResearchBoard,
  widgetId: string,
  patch: { title?: string; body?: string },
): ResearchBoard {
  return {
    ...board,
    groups: board.groups.map((group) => ({
      ...group,
      widgets: group.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, ...patch } : widget,
      ),
    })),
  };
}

export function applyOuterLayout(
  board: ResearchBoard,
  layout: readonly ResearchWidgetLayout[],
): ResearchBoard {
  const byId = new Map(layout.map((item) => [item.i, item]));
  return {
    ...board,
    groups: board.groups.map((group) => {
      const next = byId.get(group.id);
      if (!next || layoutsEqual(group.layout, next)) return group;
      return { ...group, layout: mergeLayout(group.layout, next) };
    }),
  };
}

export function applyInnerLayout(
  board: ResearchBoard,
  groupId: string,
  layout: readonly ResearchWidgetLayout[],
): ResearchBoard {
  const byId = new Map(layout.map((item) => [item.i, item]));
  return {
    ...board,
    groups: board.groups.map((group) => {
      if (group.id !== groupId) return group;
      let changed = false;
      const widgets = group.widgets.map((widget) => {
        const next = byId.get(widget.id);
        if (!next || layoutsEqual(widget.layout, next)) return widget;
        changed = true;
        return { ...widget, layout: mergeLayout(widget.layout, next) };
      });
      return changed ? { ...group, widgets } : group;
    }),
  };
}

export function moveWidget(
  board: ResearchBoard,
  widgetId: string,
  toGroupId: string,
): ResearchBoard {
  let moved: ResearchWidget | undefined;
  const stripped = board.groups.map((group) => {
    const found = group.widgets.find((widget) => widget.id === widgetId);
    if (!found) return group;
    if (group.id === toGroupId) {
      moved = found;
      return group;
    }
    moved = found;
    return { ...group, widgets: group.widgets.filter((widget) => widget.id !== widgetId) };
  });
  if (!moved) return board;
  const alreadyThere = board.groups.some(
    (group) => group.id === toGroupId && group.widgets.some((widget) => widget.id === widgetId),
  );
  if (alreadyThere) return board;
  return {
    ...board,
    groups: stripped.map((group) => {
      if (group.id !== toGroupId || !moved) return group;
      const y = group.widgets.reduce((max, widget) => Math.max(max, widget.layout.y + widget.layout.h), 0);
      return {
        ...group,
        widgets: [
          ...group.widgets,
          { ...moved, layout: { ...moved.layout, x: 0, y, i: moved.id } },
        ],
      };
    }),
  };
}

export function layoutsEqual(a: ResearchWidgetLayout, b: ResearchWidgetLayout): boolean {
  return a.i === b.i && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function layoutListEqual(
  a: readonly ResearchWidgetLayout[],
  b: readonly ResearchWidgetLayout[],
): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((item) => [item.i, item]));
  return a.every((item) => {
    const other = byId.get(item.i);
    return other ? layoutsEqual(item, other) : false;
  });
}

function mergeLayout(
  prev: ResearchWidgetLayout,
  next: ResearchWidgetLayout,
): ResearchWidgetLayout {
  return {
    ...prev,
    i: prev.i,
    x: next.x,
    y: next.y,
    w: next.w,
    h: next.h,
  };
}

export function parseBoardDocument(input: unknown): ResearchGroup[] {
  const groups = extractGroups(input);
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((item) => {
    const group = parseGroup(item);
    return group ? [group] : [];
  });
}

function extractGroups(input: unknown): unknown {
  if (!input || typeof input !== 'object') return [];
  const record = input as Record<string, unknown>;
  if (Array.isArray(record.groups)) return record.groups;
  if (Array.isArray(input)) return input;
  return [];
}

function parseGroup(input: unknown): ResearchGroup | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.title !== 'string') return null;
  const layout = parseLayout(record.layout, record.id);
  const widgets = Array.isArray(record.widgets)
    ? record.widgets.flatMap((item) => {
        const widget = parseWidget(item);
        return widget ? [widget] : [];
      })
    : [];
  return {
    id: record.id,
    title: record.title,
    summary: typeof record.summary === 'string' ? record.summary : '',
    layout,
    widgets,
  };
}

function parseWidget(input: unknown): ResearchWidget | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.title !== 'string') return null;
  if (!WIDGET_KINDS.includes(record.kind as ResearchWidgetKind)) return null;
  const widget: ResearchWidget = {
    id: record.id,
    kind: record.kind as ResearchWidgetKind,
    title: record.title,
    layout: parseLayout(record.layout, record.id),
  };
  if (typeof record.body === 'string') widget.body = record.body;
  if (typeof record.source === 'string') widget.source = record.source;
  if (typeof record.href === 'string') widget.href = record.href;
  if (typeof record.hrefLabel === 'string') widget.hrefLabel = record.hrefLabel;
  if (Array.isArray(record.items)) {
    widget.items = record.items.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      if (typeof row.title !== 'string') return [];
      return [
        {
          title: row.title,
          href: typeof row.href === 'string' ? row.href : undefined,
          note: typeof row.note === 'string' ? row.note : undefined,
        },
      ];
    });
  }
  if (record.metric && typeof record.metric === 'object') {
    const metric = record.metric as Record<string, unknown>;
    if (typeof metric.value === 'string' && typeof metric.caption === 'string') {
      widget.metric = { value: metric.value, caption: metric.caption };
    }
  }
  return widget;
}

function parseLayout(input: unknown, fallbackId: string): ResearchWidgetLayout {
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    if (
      typeof record.x === 'number' &&
      typeof record.y === 'number' &&
      typeof record.w === 'number' &&
      typeof record.h === 'number'
    ) {
      return {
        i: typeof record.i === 'string' ? record.i : fallbackId,
        x: record.x,
        y: record.y,
        w: record.w,
        h: record.h,
        minW: typeof record.minW === 'number' ? record.minW : undefined,
        minH: typeof record.minH === 'number' ? record.minH : undefined,
      };
    }
  }
  return { i: fallbackId, x: 0, y: 0, w: 6, h: 8, minW: 3, minH: 4 };
}
