'use client';

import { memo, type ReactNode } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ArrowRightIcon, NewspaperIcon, TrendUpIcon } from '@phosphor-icons/react';
import type { ProductStory, StoryLine, StoryProduct } from '@/lib/product-story';
import type { StoryNodeData } from '@/lib/product-story/graph';
import { nodeIdLine, nodeIdProduct } from '@/lib/product-story/graph';
import { cn } from '@/lib/cn';
import { useStoryNav } from './story-nav';

export const StoryNode = memo(function StoryNode(props: NodeProps<Node<StoryNodeData>>) {
  const { focusId, go } = useStoryNav();
  const { data, id } = props;
  const active = id === focusId;
  return <StoryNodeBody data={data} active={active} onGo={go} />;
});

function StoryNodeBody({
  data,
  active,
  onGo,
}: {
  data: StoryNodeData;
  active: boolean;
  onGo: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm',
        active ? 'border-foreground/35 ring-2 ring-foreground/10' : 'border-border opacity-55',
      )}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <NodeScrollPane active={active}>
        {data.kind === 'overview' && <OverviewBody story={data.story} onGo={onGo} />}
        {data.kind === 'line' && data.line && (
          <LineBody
            line={data.line}
            nextLabel={data.nextLabel}
            nextId={data.nextId}
            onGo={onGo}
          />
        )}
        {data.kind === 'product' && data.line && data.product && (
          <ProductBody
            line={data.line}
            product={data.product}
            nextLabel={data.nextLabel}
            nextId={data.nextId}
            onGo={onGo}
          />
        )}
      </NodeScrollPane>
    </div>
  );
}

/** 캔버스 줌은 막고, 이 상자만 세로로 굴린다. */
function NodeScrollPane({ children, active }: { children: ReactNode; active: boolean }) {
  return (
    <div
      data-story-scroll={active ? 'active' : undefined}
      className="nowheel nodrag nopan min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
    >
      {children}
    </div>
  );
}

function OverviewBody({
  story,
  onGo,
}: {
  story: ProductStory;
  onGo: (id: string) => void;
}) {
  return (
    <article className="px-5 py-6">
      <p className="font-mono text-[11px] text-muted-foreground">장면 1 · 회사 전체</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight">{story.brand} 제품 지도</h1>
      <p className="mt-2 text-sm leading-relaxed text-foreground/85">{story.thesis}</p>
      <div className="mt-5 space-y-5">
        {story.mix.map((block) => (
          <section key={block.title}>
            <h2 className="text-sm font-semibold">{block.title}</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {block.href ? (
                <a href={block.href} className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                  {block.source}
                </a>
              ) : (
                block.source
              )}
            </p>
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {block.rows.map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-2 px-2.5 py-2 text-sm">
                  <span>
                    {row.label}
                    {row.note && (
                      <span className="ml-1 text-[11px] text-muted-foreground">{row.note}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="font-medium">{row.amount}</span>
                    {row.yoy && <span className="ml-1.5 text-[11px] text-muted-foreground">{row.yoy}</span>}
                    {row.share && <span className="ml-1.5 text-[11px] text-muted-foreground">{row.share}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className="mt-6">
        <h2 className="text-sm font-semibold">라인으로 들어가기</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          카드를 누르면 카메라가 그 노드로 강제 이동한다. 휠 줌·드래그 팬은 꺼져 있다.
        </p>
        <ul className="mt-3 grid gap-2">
          {story.lines.map((line) => (
            <li key={line.id}>
              <button
                type="button"
                data-go={nodeIdLine(line.id)}
                onClick={() => onGo(nodeIdLine(line.id))}
                className="flex w-full flex-col rounded-xl border border-border bg-background px-3 py-2.5 text-left hover:border-foreground/20 hover:bg-muted/40"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{line.name}</span>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </span>
                <span className="mt-1 text-[11px] text-muted-foreground">{line.concern}</span>
                <span className="mt-1 text-sm leading-relaxed text-foreground/80">{line.brief}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <footer className="mt-8 border-t border-border pt-3 text-[11px] text-muted-foreground">
        출처는 공개 자료. SKU 매출은 공시 없음.
        <ul className="mt-1 flex flex-wrap gap-x-2">
          {story.sources.map((s) => (
            <li key={s.href}>
              <a href={s.href} className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </article>
  );
}

function LineBody({
  line,
  nextId,
  nextLabel,
  onGo,
}: {
  line: StoryLine;
  nextId: string | null;
  nextLabel: string | null;
  onGo: (id: string) => void;
}) {
  return (
    <article className="px-5 py-6">
      <p className="font-mono text-[11px] text-muted-foreground">장면 2 · {line.concern}</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight">{line.name}</h1>
      <p className="mt-2 text-sm leading-relaxed text-foreground/85">{line.brief}</p>
      <GrowthList facts={line.growth} />
      <NewsList items={line.news} />
      <section className="mt-6">
        <h2 className="text-sm font-semibold">제품</h2>
        <ul className="mt-2 space-y-2">
          {line.products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                data-go={nodeIdProduct(p.id)}
                onClick={() => onGo(nodeIdProduct(p.id))}
                className="flex w-full items-start justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left hover:bg-muted/40"
              >
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {p.name}
                    {p.hit && (
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                        히트
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-foreground/75">{p.role}</span>
                </span>
                <ArrowRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </section>
      {nextId && nextLabel && <NextCue label={`다음 라인 · ${nextLabel}`} onClick={() => onGo(nextId)} />}
    </article>
  );
}

function ProductBody({
  line,
  product,
  nextId,
  nextLabel,
  onGo,
}: {
  line: StoryLine;
  product: StoryProduct;
  nextId: string | null;
  nextLabel: string | null;
  onGo: (id: string) => void;
}) {
  return (
    <article className="px-5 py-6">
      <p className="font-mono text-[11px] text-muted-foreground">장면 3 · {line.name}</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight">{product.name}</h1>
      <p className="mt-2 text-sm leading-relaxed text-foreground/85">{product.role}</p>
      <GrowthList
        facts={product.growth}
        empty="SKU 매출·성장률은 공시에 없다. 단위 판매가 있는 경우만 적었다."
      />
      <NewsList items={product.news} />
      {nextId && nextLabel && (
        <NextCue label={`같은 라인 다음 · ${nextLabel}`} onClick={() => onGo(nextId)} />
      )}
    </article>
  );
}

function GrowthList({
  facts,
  empty,
}: {
  facts: StoryLine['growth'];
  empty?: string;
}) {
  if (facts.length === 0) {
    return (
      <p className="mt-5 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        {empty ?? '이 장면의 성장 수치는 확인 불가'}
      </p>
    );
  }
  return (
    <section className="mt-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <TrendUpIcon className="size-4" />
        성장 단서
      </h2>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
        {facts.map((f) => (
          <li key={f.label} className="px-3 py-2">
            <p className="text-sm font-medium">{f.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {f.label}
              {' · '}
              {f.href ? (
                <a href={f.href} className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                  {f.source}
                </a>
              ) : (
                f.source
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NewsList({ items }: { items: StoryLine['news'] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <NewspaperIcon className="size-4" />
        뉴스
      </h2>
      <ul className="mt-2 space-y-2">
        {items.map((n) => (
          <li key={n.href + n.title}>
            <a
              href={n.href}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-border px-3 py-2 hover:bg-muted/40"
            >
              <span className="text-sm font-medium underline-offset-2 hover:underline">{n.title}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {[n.date, n.note].filter(Boolean).join(' · ')}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextCue({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="mt-8 border-t border-dashed border-border pt-5 pb-2">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-left text-sm hover:bg-muted/60"
      >
        <span>{label}</span>
        <ArrowRightIcon className="size-4" />
      </button>
    </div>
  );
}
