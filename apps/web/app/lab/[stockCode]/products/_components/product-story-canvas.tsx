'use client';

/**
 * React Flow 엔진 + 조작 잠금.
 * 휠 줌·핀치·드래그 팬·노드 드래그는 끈다. 카메라는 카드 클릭/뒤로/Esc의 fitView만 움직인다.
 * 노드 안 세로 스크롤은 nowheel + preventScrolling={false}로 웹페이지처럼 남긴다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type DefaultEdgeOptions,
  type NodeTypes,
} from '@xyflow/react';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import type { ProductStory } from '@/lib/product-story';
import {
  buildStoryGraph,
  crumbsFor,
  nodeIdOverview,
  parentOfFocus,
} from '@/lib/product-story/graph';
import { StoryNavContext } from './story-nav';
import { StoryNode } from './story-nodes';

const nodeTypes = { story: StoryNode } satisfies NodeTypes;

const defaultEdgeOptions = {
  type: 'smoothstep',
  selectable: false,
  focusable: false,
  interactionWidth: 0,
  style: { stroke: 'var(--border)', strokeWidth: 1.5 },
} satisfies DefaultEdgeOptions;

export function ProductStoryCanvas({ story }: { story: ProductStory }) {
  return (
    <ReactFlowProvider>
      <LockedStoryFlow story={story} />
    </ReactFlowProvider>
  );
}

function LockedStoryFlow({ story }: { story: ProductStory }) {
  const { nodes, edges } = useMemo(() => buildStoryGraph(story), [story]);
  const [focusId, setFocusId] = useState(nodeIdOverview());
  const { fitView } = useReactFlow();

  const go = useCallback((id: string) => {
    setFocusId(id);
  }, []);

  const back = useCallback(() => {
    const parent = parentOfFocus(story, focusId);
    if (parent) setFocusId(parent);
  }, [focusId, story]);

  const focusNode = useCallback(
    (id: string, duration: number) => {
      void fitView({
        nodes: [{ id }],
        duration,
        padding: 0.1,
        maxZoom: 1.08,
        minZoom: 0.35,
      });
    },
    [fitView],
  );

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    focusNode(focusId, reduce ? 0 : 560);
  }, [focusId, focusNode]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (focusId === nodeIdOverview()) return;
      e.preventDefault();
      e.stopPropagation();
      back();
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [back, focusId]);

  const crumbs = crumbsFor(story, focusId);
  const nav = useMemo(() => ({ focusId, go }), [focusId, go]);

  return (
    <StoryNavContext.Provider value={nav}>
      <div className="relative flex h-[calc(100dvh-3rem)] min-h-[32rem] flex-col overflow-hidden bg-background">
        <nav
          className="z-10 flex shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 py-2 sm:px-6"
          aria-label="장면 경로"
        >
          {focusId !== nodeIdOverview() && (
            <button
              type="button"
              onClick={back}
              className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="이전 장면"
            >
              <ArrowLeftIcon />
            </button>
          )}
          <ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <li key={c.id} className="flex min-w-0 items-center gap-1">
                {i > 0 && <span aria-hidden>/</span>}
                <button
                  type="button"
                  onClick={() => go(c.id)}
                  className={
                    c.id === focusId
                      ? 'truncate font-medium text-foreground'
                      : 'truncate hover:text-foreground'
                  }
                >
                  {c.label}
                </button>
              </li>
            ))}
          </ol>
          <span className="ml-auto hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">
            React Flow · 팬/줌 잠금 · 카메라만 이동 · Esc 줌아웃
          </span>
        </nav>
        <div className="min-h-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            selectionOnDrag={false}
            preventScrolling={false}
            autoPanOnConnect={false}
            autoPanOnNodeDrag={false}
            elevateNodesOnSelect={false}
            deleteKeyCode={null}
            multiSelectionKeyCode={null}
            selectionKeyCode={null}
            minZoom={0.2}
            maxZoom={1.2}
            defaultEdgeOptions={defaultEdgeOptions}
            colorMode="system"
            onInit={(instance) => {
              void instance.fitView({
                nodes: [{ id: nodeIdOverview() }],
                padding: 0.1,
                maxZoom: 1.08,
              });
            }}
          >
            <Background gap={28} size={1} color="var(--border)" />
          </ReactFlow>
        </div>
      </div>
    </StoryNavContext.Provider>
  );
}
