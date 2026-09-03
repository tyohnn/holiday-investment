'use client';

import { useCallback, useMemo, useState } from 'react';
import GridLayout, { type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { ResearchBoard, ResearchGroup, ResearchInnerMode } from '@/lib/research';
import {
  addNoteWidget,
  applyInnerLayout,
  layoutListEqual,
  moveWidget,
  removeGroup,
  renameGroup,
} from '@/lib/research/document';
import { INNER_GRID, PLAIN_CARD_MIN_PX } from '@/lib/research/grid';
import { flowInnerWidth } from '@/lib/research/flow-layout';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { ResearchWidgetCard, WIDGET_MIME } from '@/components/research/research-widget-card';

export function ResearchGroupPane({
  board,
  group,
  onChange,
  innerMode,
  interactive,
  focused,
}: {
  board: ResearchBoard;
  group: ResearchGroup;
  onChange: (next: ResearchBoard) => void;
  innerMode: ResearchInnerMode;
  interactive: boolean;
  focused: boolean;
}) {
  const [dropActive, setDropActive] = useState(false);
  const width = flowInnerWidth();
  const layout = useMemo(() => group.widgets.map((widget) => widget.layout), [group.widgets]);

  const onLayoutChange = useCallback(
    (next: Layout) => {
      if (!interactive || innerMode !== 'rgl') return;
      if (layoutListEqual(layout, next)) return;
      onChange(applyInnerLayout(board, group.id, next));
    },
    [board, group.id, innerMode, interactive, layout, onChange],
  );

  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col overflow-visible rounded-2xl border bg-card shadow-[var(--shadow-card)]',
        dropActive ? 'border-primary' : 'border-border',
        focused && 'ring-2 ring-primary/40',
      )}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(WIDGET_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(event) => {
        const widgetId = event.dataTransfer.getData(WIDGET_MIME);
        setDropActive(false);
        if (!widgetId) return;
        event.preventDefault();
        onChange(moveWidget(board, widgetId, group.id));
      }}
    >
      <header className="flex shrink-0 items-start gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <input
            className="w-full truncate bg-transparent text-sm font-semibold tracking-tight outline-none"
            value={group.title}
            aria-label="그룹 제목"
            onChange={(event) => onChange(renameGroup(board, group.id, { title: event.target.value }))}
          />
          <input
            className="mt-0.5 w-full truncate bg-transparent text-[11px] text-muted-foreground outline-none"
            value={group.summary}
            aria-label="그룹 설명"
            placeholder="그룹 설명"
            onChange={(event) =>
              onChange(renameGroup(board, group.id, { summary: event.target.value }))
            }
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="노트 추가"
          onClick={() => onChange(addNoteWidget(board, group.id))}
        >
          <PlusIcon className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="그룹 삭제"
          onClick={() => onChange(removeGroup(board, group.id))}
        >
          <TrashIcon className="size-3.5" />
        </Button>
      </header>
      <div className="research-nested nodrag nopan nowheel overflow-visible px-2 py-2">
        {innerMode === 'rgl' ? (
          <div className="research-grid">
            <GridLayout
              width={width}
              layout={layout}
              autoSize
              gridConfig={{
                cols: INNER_GRID.cols,
                rowHeight: INNER_GRID.rowHeight,
                margin: INNER_GRID.margin,
              }}
              dragConfig={{ enabled: interactive, handle: '.research-widget-drag' }}
              resizeConfig={{ enabled: interactive }}
              onLayoutChange={onLayoutChange}
            >
              {group.widgets.map((widget) => (
                <div key={widget.id} className="h-full">
                  <ResearchWidgetCard
                    board={board}
                    groupId={group.id}
                    widget={widget}
                    onChange={onChange}
                    showGridHandle={interactive}
                  />
                </div>
              ))}
            </GridLayout>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {group.widgets.length === 0 && (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">카드가 없습니다</p>
            )}
            {group.widgets.map((widget) => (
              <div key={widget.id} style={{ minHeight: PLAIN_CARD_MIN_PX }}>
                <ResearchWidgetCard
                  board={board}
                  groupId={group.id}
                  widget={widget}
                  onChange={onChange}
                  showGridHandle={false}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
