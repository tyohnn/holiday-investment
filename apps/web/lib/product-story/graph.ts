import type { Edge, Node } from '@xyflow/react';
import type { ProductStory, StoryLine, StoryProduct } from './types';

export const STORY_NODE_W = 560;
export const STORY_NODE_H = 720;
const COL = 720;
const ROW = 860;

export type StoryNodeKind = 'overview' | 'line' | 'product';

export type StoryNodeData = {
  kind: StoryNodeKind;
  story: ProductStory;
  line?: StoryLine;
  product?: StoryProduct;
  parentId: string | null;
  nextId: string | null;
  nextLabel: string | null;
};

export function nodeIdOverview(): string {
  return 'overview';
}
export function nodeIdLine(lineId: string): string {
  return `line:${lineId}`;
}
export function nodeIdProduct(productId: string): string {
  return `product:${productId}`;
}

export function buildStoryGraph(story: ProductStory): {
  nodes: Node<StoryNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<StoryNodeData>[] = [];
  const edges: Edge[] = [];
  const lineCount = Math.max(story.lines.length, 1);
  const overviewX = ((lineCount - 1) * COL) / 2;

  nodes.push({
    id: nodeIdOverview(),
    type: 'story',
    position: { x: overviewX, y: 0 },
    draggable: false,
    connectable: false,
    selectable: false,
    data: {
      kind: 'overview',
      story,
      parentId: null,
      nextId: story.lines[0] ? nodeIdLine(story.lines[0].id) : null,
      nextLabel: story.lines[0]?.name ?? null,
    },
    style: { width: STORY_NODE_W, height: STORY_NODE_H },
  });

  story.lines.forEach((line, i) => {
    const nextLine = story.lines[i + 1];
    const lineNodeId = nodeIdLine(line.id);
    nodes.push({
      id: lineNodeId,
      type: 'story',
      position: { x: i * COL, y: ROW },
      draggable: false,
      connectable: false,
      selectable: false,
      data: {
        kind: 'line',
        story,
        line,
        parentId: nodeIdOverview(),
        nextId: nextLine ? nodeIdLine(nextLine.id) : null,
        nextLabel: nextLine?.name ?? null,
      },
      style: { width: STORY_NODE_W, height: STORY_NODE_H },
    });
    edges.push({
      id: `e-ov-${line.id}`,
      source: nodeIdOverview(),
      target: lineNodeId,
      type: 'smoothstep',
      selectable: false,
      focusable: false,
    });

    line.products.forEach((product, j) => {
      const nextProduct = line.products[j + 1];
      const productNodeId = nodeIdProduct(product.id);
      nodes.push({
        id: productNodeId,
        type: 'story',
        position: { x: i * COL, y: ROW + (j + 1) * ROW },
        draggable: false,
        connectable: false,
        selectable: false,
        data: {
          kind: 'product',
          story,
          line,
          product,
          parentId: lineNodeId,
          nextId: nextProduct ? nodeIdProduct(nextProduct.id) : null,
          nextLabel: nextProduct?.name ?? null,
        },
        style: { width: STORY_NODE_W, height: STORY_NODE_H },
      });
      edges.push({
        id: `e-${line.id}-${product.id}`,
        source: lineNodeId,
        target: productNodeId,
        type: 'smoothstep',
        selectable: false,
        focusable: false,
      });
    });
  });

  return { nodes, edges };
}

export function parentOfFocus(story: ProductStory, focusId: string): string | null {
  if (focusId === nodeIdOverview()) return null;
  if (focusId.startsWith('line:')) return nodeIdOverview();
  const productId = focusId.slice('product:'.length);
  for (const line of story.lines) {
    if (line.products.some((p) => p.id === productId)) return nodeIdLine(line.id);
  }
  return nodeIdOverview();
}

export function crumbsFor(story: ProductStory, focusId: string): { id: string; label: string }[] {
  const crumbs = [{ id: nodeIdOverview(), label: story.brand }];
  if (focusId.startsWith('line:')) {
    const line = story.lines.find((l) => nodeIdLine(l.id) === focusId);
    if (line) crumbs.push({ id: focusId, label: line.name });
  }
  if (focusId.startsWith('product:')) {
    const productId = focusId.slice('product:'.length);
    for (const line of story.lines) {
      const product = line.products.find((p) => p.id === productId);
      if (product) {
        crumbs.push({ id: nodeIdLine(line.id), label: line.name });
        crumbs.push({ id: focusId, label: product.name });
        break;
      }
    }
  }
  return crumbs;
}
