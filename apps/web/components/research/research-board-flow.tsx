'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Background,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CaretLeftIcon, CaretRightIcon, PlusIcon } from '@phosphor-icons/react';
import type { ResearchBoard, ResearchInnerMode } from '@/lib/research';
import { addGroup } from '@/lib/research/document';
import {
  FLOW_CAMERA_MS,
  boxCenter,
  packFlowGroups,
  type FlowGroupBox,
} from '@/lib/research/flow-layout';
import { Button } from '@/components/ui/button';
import { ResearchGroupPane } from '@/components/research/research-group-pane';

type Focus =
  | { kind: 'overview' }
  | { kind: 'group'; id: string };

type FlowContextValue = {
  board: ResearchBoard;
  onChange: (next: ResearchBoard) => void;
  innerMode: ResearchInnerMode;
  interactive: boolean;
  focusedId: string | null;
};

const FlowContext = createContext<FlowContextValue | null>(null);

function useFlowBoard(): FlowContextValue {
  const value = useContext(FlowContext);
  if (!value) throw new Error('Research flow context missing');
  return value;
}

function GroupSlideNode({ id }: { id: string }) {
  const { board, onChange, innerMode, interactive, focusedId } = useFlowBoard();
  const group = board.groups.find((item) => item.id === id);
  if (!group) return null;
  return (
    <ResearchGroupPane
      board={board}
      group={group}
      onChange={onChange}
      innerMode={innerMode}
      interactive={interactive}
      focused={focusedId === id}
    />
  );
}

const nodeTypes: NodeTypes = {
  groupSlide: GroupSlideNode,
};

function Camera({
  focus,
  boxes,
}: {
  focus: Focus;
  boxes: readonly FlowGroupBox[];
}) {
  const { setCenter, fitView } = useReactFlow();

  useEffect(() => {
    if (focus.kind === 'overview') {
      if (boxes.length === 0) return;
      const id = requestAnimationFrame(() => {
        void fitView({ duration: FLOW_CAMERA_MS, padding: 0.22 });
      });
      return () => cancelAnimationFrame(id);
    }
    const box = boxes.find((item) => item.id === focus.id);
    if (!box) return;
    const center = boxCenter(box);
    const id = requestAnimationFrame(() => {
      void setCenter(center.x, center.y, { zoom: 1, duration: FLOW_CAMERA_MS });
    });
    return () => cancelAnimationFrame(id);
  }, [boxes, fitView, focus, setCenter]);

  return null;
}

function SlideshowBar({
  board,
  focus,
  onFocus,
  innerMode,
  onInnerMode,
  onAddGroup,
}: {
  board: ResearchBoard;
  focus: Focus;
  onFocus: (next: Focus) => void;
  innerMode: ResearchInnerMode;
  onInnerMode: (mode: ResearchInnerMode) => void;
  onAddGroup: () => void;
}) {
  const index =
    focus.kind === 'overview'
      ? -1
      : board.groups.findIndex((group) => group.id === focus.id);

  function go(delta: number) {
    if (board.groups.length === 0) {
      onFocus({ kind: 'overview' });
      return;
    }
    const current = index < 0 ? -1 : index;
    const next = current + delta;
    if (next < 0) {
      onFocus({ kind: 'overview' });
      return;
    }
    const group = board.groups[Math.min(next, board.groups.length - 1)];
    if (group) onFocus({ kind: 'group', id: group.id });
  }

  return (
    <Panel position="top-center" className="!m-3 w-[min(72rem,calc(100%-1.5rem))]">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/95 px-2 py-1.5 shadow-[var(--shadow-card)] backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="이전 슬라이드"
          onClick={() => go(-1)}
        >
          <CaretLeftIcon className="size-3.5" />
        </Button>
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-label="보드 목차">
          <Button
            type="button"
            size="xs"
            variant={focus.kind === 'overview' ? 'default' : 'ghost'}
            onClick={() => onFocus({ kind: 'overview' })}
          >
            전체
          </Button>
          {board.groups.map((group, groupIndex) => (
            <Button
              key={group.id}
              type="button"
              size="xs"
              variant={focus.kind === 'group' && focus.id === group.id ? 'default' : 'ghost'}
              onClick={() => onFocus({ kind: 'group', id: group.id })}
            >
              {groupIndex + 1}. {group.title || '이름 없는 그룹'}
            </Button>
          ))}
        </nav>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="다음 슬라이드"
          onClick={() => go(1)}
        >
          <CaretRightIcon className="size-3.5" />
        </Button>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="xs"
            variant={innerMode === 'rgl' ? 'secondary' : 'ghost'}
            onClick={() => onInnerMode('rgl')}
          >
            RGL
          </Button>
          <Button
            type="button"
            size="xs"
            variant={innerMode === 'plain' ? 'secondary' : 'ghost'}
            onClick={() => onInnerMode('plain')}
          >
            일반
          </Button>
        </div>
        <Button type="button" variant="outline" size="xs" onClick={onAddGroup}>
          <PlusIcon className="size-3.5" />
          그룹
        </Button>
      </div>
    </Panel>
  );
}

function FlowInner({
  board,
  onChange,
  innerMode,
  focus,
  onFocus,
  onInnerMode,
}: {
  board: ResearchBoard;
  onChange: (next: ResearchBoard) => void;
  innerMode: ResearchInnerMode;
  focus: Focus;
  onFocus: (next: Focus) => void;
  onInnerMode: (mode: ResearchInnerMode) => void;
}) {
  const boxes = useMemo(() => packFlowGroups(board.groups, innerMode), [board.groups, innerMode]);
  const focusedId = focus.kind === 'group' ? focus.id : null;
  const interactive = focus.kind === 'group' && innerMode === 'rgl';

  const nodes = useMemo<Node[]>(
    () =>
      boxes.map((box) => ({
        id: box.id,
        type: 'groupSlide',
        position: { x: box.x, y: box.y },
        data: {},
        draggable: false,
        selectable: false,
        connectable: false,
        style: { width: box.width, height: box.height },
      })),
    [boxes],
  );

  const context = useMemo<FlowContextValue>(
    () => ({ board, onChange, innerMode, interactive, focusedId }),
    [board, focusedId, innerMode, interactive, onChange],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const index =
          focus.kind === 'overview' ? -1 : board.groups.findIndex((group) => group.id === focus.id);
        const next = board.groups[index + 1];
        if (next) onFocus({ kind: 'group', id: next.id });
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (focus.kind === 'overview') return;
        const index = board.groups.findIndex((group) => group.id === focus.id);
        const prev = board.groups[index - 1];
        if (prev) onFocus({ kind: 'group', id: prev.id });
        else onFocus({ kind: 'overview' });
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onFocus({ kind: 'overview' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [board.groups, focus, onFocus]);

  function handleAddGroup() {
    const next = addGroup(board);
    const created = next.groups[next.groups.length - 1];
    onChange(next);
    if (created) onFocus({ kind: 'group', id: created.id });
  }

  return (
    <FlowContext.Provider value={context}>
      <ReactFlow
        className="research-flow"
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
        preventScrolling
        minZoom={0.15}
        maxZoom={1}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => onFocus({ kind: 'group', id: node.id })}
      >
        <Background gap={28} size={1} />
        <Camera focus={focus} boxes={boxes} />
        <SlideshowBar
          board={board}
          focus={focus}
          onFocus={onFocus}
          innerMode={innerMode}
          onInnerMode={onInnerMode}
          onAddGroup={handleAddGroup}
        />
      </ReactFlow>
    </FlowContext.Provider>
  );
}

export function ResearchBoardFlow({
  board,
  onChange,
}: {
  board: ResearchBoard;
  onChange: (next: ResearchBoard) => void;
}) {
  const [innerMode, setInnerMode] = useState<ResearchInnerMode>('rgl');
  const [focus, setFocus] = useState<Focus>(() =>
    board.groups[0] ? { kind: 'group', id: board.groups[0].id } : { kind: 'overview' },
  );

  useEffect(() => {
    if (focus.kind === 'overview') return;
    if (board.groups.some((group) => group.id === focus.id)) return;
    const first = board.groups[0];
    setFocus(first ? { kind: 'group', id: first.id } : { kind: 'overview' });
  }, [board.groups, focus]);

  return (
    <div className="h-full min-h-[28rem] w-full">
      <ReactFlowProvider>
        <FlowInner
          board={board}
          onChange={onChange}
          innerMode={innerMode}
          focus={focus}
          onFocus={setFocus}
          onInnerMode={setInnerMode}
        />
      </ReactFlowProvider>
    </div>
  );
}
