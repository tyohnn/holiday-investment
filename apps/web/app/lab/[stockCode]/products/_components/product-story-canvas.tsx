'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  NewspaperIcon,
  TrendUpIcon,
} from '@phosphor-icons/react';
import type { ProductStory, StoryLine, StoryProduct } from '@/lib/product-story';
import { cn } from '@/lib/cn';

type Frame =
  | { kind: 'overview' }
  | { kind: 'line'; lineId: string }
  | { kind: 'product'; lineId: string; productId: string };

function lineOf(story: ProductStory, id: string): StoryLine | undefined {
  return story.lines.find((l) => l.id === id);
}

function productOf(line: StoryLine, id: string): StoryProduct | undefined {
  return line.products.find((p) => p.id === id);
}

function crumbLabel(story: ProductStory, frame: Frame): string {
  if (frame.kind === 'overview') return story.brand;
  const line = lineOf(story, frame.lineId);
  if (frame.kind === 'line') return line?.name ?? frame.lineId;
  return productOf(line!, frame.productId)?.name ?? frame.productId;
}

export function ProductStoryCanvas({ story }: { story: ProductStory }) {
  const [frame, setFrame] = useState<Frame>({ kind: 'overview' });
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const go = useCallback((next: Frame) => {
    setFrame(next);
  }, []);

  const back = useCallback(() => {
    setFrame((cur) => {
      if (cur.kind === 'product') return { kind: 'line', lineId: cur.lineId };
      if (cur.kind === 'line') return { kind: 'overview' };
      return cur;
    });
  }, []);

  useGSAP(
    () => {
      const panel = panelRef.current;
      if (!panel) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          panel,
          { opacity: 0, scale: 1.06, y: 18 },
          { opacity: 1, scale: 1, y: 0, duration: 0.48, ease: 'power3.out' },
        );
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(panel, { opacity: 1, scale: 1, y: 0 });
      });
      return () => mm.revert();
    },
    { scope: stageRef, dependencies: [frame] },
  );

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [frame]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && frame.kind !== 'overview') {
        e.preventDefault();
        back();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, frame.kind]);

  const line = frame.kind === 'overview' ? undefined : lineOf(story, frame.lineId);
  const product =
    frame.kind === 'product' && line ? productOf(line, frame.productId) : undefined;

  return (
    <div
      ref={stageRef}
      className="relative flex h-[calc(100dvh-3rem)] min-h-[32rem] flex-col overflow-hidden bg-background"
    >
      <nav
        className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 sm:px-6"
        aria-label="장면 경로"
      >
        {frame.kind !== 'overview' && (
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
          <li>
            <button
              type="button"
              className={cn(
                'truncate hover:text-foreground',
                frame.kind === 'overview' && 'font-medium text-foreground',
              )}
              onClick={() => go({ kind: 'overview' })}
            >
              {story.brand}
            </button>
          </li>
          {frame.kind !== 'overview' && line && (
            <>
              <li aria-hidden>/</li>
              <li>
                <button
                  type="button"
                  className={cn(
                    'truncate hover:text-foreground',
                    frame.kind === 'line' && 'font-medium text-foreground',
                  )}
                  onClick={() => go({ kind: 'line', lineId: line.id })}
                >
                  {line.name}
                </button>
              </li>
            </>
          )}
          {frame.kind === 'product' && product && (
            <>
              <li aria-hidden>/</li>
              <li className="truncate font-medium text-foreground">{product.name}</li>
            </>
          )}
        </ol>
        <span className="ml-auto hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">
          이 장면은 세로 스크롤 · Esc 로 줌아웃 · 기준 {story.asOf}
        </span>
      </nav>

      <div
        ref={panelRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        aria-labelledby={headingId}
      >
        {frame.kind === 'overview' && (
          <OverviewScene
            story={story}
            headingId={headingId}
            onEnterLine={(lineId) => go({ kind: 'line', lineId })}
          />
        )}
        {frame.kind === 'line' && line && (
          <LineScene
            line={line}
            headingId={headingId}
            onEnterProduct={(productId) =>
              go({ kind: 'product', lineId: line.id, productId })
            }
            onNextLine={
              nextLineId(story, line.id)
                ? () => go({ kind: 'line', lineId: nextLineId(story, line.id)! })
                : undefined
            }
            nextLabel={nextLineId(story, line.id)
              ? lineOf(story, nextLineId(story, line.id)!)?.name
              : undefined}
          />
        )}
        {frame.kind === 'product' && line && product && (
          <ProductScene
            line={line}
            product={product}
            headingId={headingId}
            onNextProduct={
              nextProductId(line, product.id)
                ? () =>
                    go({
                      kind: 'product',
                      lineId: line.id,
                      productId: nextProductId(line, product.id)!,
                    })
                : undefined
            }
            nextLabel={
              nextProductId(line, product.id)
                ? productOf(line, nextProductId(line, product.id)!)?.name
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

function nextLineId(story: ProductStory, id: string): string | undefined {
  const i = story.lines.findIndex((l) => l.id === id);
  return i >= 0 ? story.lines[i + 1]?.id : undefined;
}

function nextProductId(line: StoryLine, id: string): string | undefined {
  const i = line.products.findIndex((p) => p.id === id);
  return i >= 0 ? line.products[i + 1]?.id : undefined;
}

function OverviewScene({
  story,
  headingId,
  onEnterLine,
}: {
  story: ProductStory;
  headingId: string;
  onEnterLine: (id: string) => void;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="font-mono text-[11px] text-muted-foreground">장면 1 · 회사 전체</p>
      <h1 id={headingId} className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
        {story.brand} 제품 지도
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-foreground/85">{story.thesis}</p>

      <div className="mt-8 space-y-6">
        {story.mix.map((block) => (
          <section key={block.title}>
            <h2 className="text-sm font-semibold">{block.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {block.href ? (
                <a href={block.href} className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                  {block.source}
                </a>
              ) : (
                block.source
              )}
            </p>
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
              {block.rows.map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm">
                  <span>
                    {row.label}
                    {row.note && (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">{row.note}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="font-medium">{row.amount}</span>
                    {row.yoy && (
                      <span className="ml-2 text-xs text-muted-foreground">{row.yoy}</span>
                    )}
                    {row.share && (
                      <span className="ml-2 text-xs text-muted-foreground">{row.share}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold">라인으로 들어가기</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          카드를 누르면 그 라인 장면으로 줌한다. 장면 안에서는 일반 페이지처럼 아래로만 스크롤된다.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {story.lines.map((line) => (
            <li key={line.id}>
              <button
                type="button"
                onClick={() => onEnterLine(line.id)}
                className="flex w-full flex-col rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{line.name}</span>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </span>
                <span className="mt-1 text-[11px] text-muted-foreground">{line.concern}</span>
                <span className="mt-2 text-sm leading-relaxed text-foreground/80">{line.brief}</span>
                {line.growth[0] && (
                  <span className="mt-3 font-mono text-[11px] text-muted-foreground">
                    {line.growth[0].label}: {line.growth[0].value}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <SourceFooter story={story} />
    </article>
  );
}

function LineScene({
  line,
  headingId,
  onEnterProduct,
  onNextLine,
  nextLabel,
}: {
  line: StoryLine;
  headingId: string;
  onEnterProduct: (id: string) => void;
  onNextLine?: () => void;
  nextLabel?: string;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="font-mono text-[11px] text-muted-foreground">장면 2 · 라인 · {line.concern}</p>
      <h1 id={headingId} className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
        {line.name}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-foreground/85">{line.brief}</p>

      <GrowthList facts={line.growth} />
      <NewsList items={line.news} />

      <section className="mt-8">
        <h2 className="text-sm font-semibold">제품</h2>
        <ul className="mt-3 space-y-2">
          {line.products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onEnterProduct(p.id)}
                className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-foreground/20 hover:bg-muted/40"
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

      {onNextLine && nextLabel && (
        <NextCue label={`다음 라인 · ${nextLabel}`} onClick={onNextLine} />
      )}
    </article>
  );
}

function ProductScene({
  line,
  product,
  headingId,
  onNextProduct,
  nextLabel,
}: {
  line: StoryLine;
  product: StoryProduct;
  headingId: string;
  onNextProduct?: () => void;
  nextLabel?: string;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="font-mono text-[11px] text-muted-foreground">
        장면 3 · {line.name}
      </p>
      <h1 id={headingId} className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
        {product.name}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-foreground/85">{product.role}</p>
      <GrowthList facts={product.growth} empty="SKU 매출·성장률은 공시에 없다. 단위 판매가 있는 경우만 적었다." />
      <NewsList items={product.news} />
      {onNextProduct && nextLabel && (
        <NextCue label={`같은 라인 다음 · ${nextLabel}`} onClick={onNextProduct} />
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
      <p className="mt-6 rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
        {empty ?? '이 장면의 성장 수치는 확인 불가'}
      </p>
    );
  }
  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <TrendUpIcon className="size-4" />
        성장 단서
      </h2>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
        {facts.map((f) => (
          <li key={f.label} className="px-3 py-2.5">
            <p className="text-sm font-medium">{f.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
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
    <section className="mt-6">
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
              className="block rounded-xl border border-border px-3 py-2.5 hover:bg-muted/40"
            >
              <span className="text-sm font-medium underline-offset-2 hover:underline">{n.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
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
    <div className="mt-12 border-t border-dashed border-border pt-6 pb-4">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3 text-left text-sm hover:bg-muted/60"
      >
        <span>{label}</span>
        <ArrowRightIcon className="size-4" />
      </button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        여기까지가 이 장면이다. 다음 영역은 줌으로 넘어간다.
      </p>
    </div>
  );
}

function SourceFooter({ story }: { story: ProductStory }) {
  return (
    <footer className="mt-12 border-t border-border pt-4 text-xs text-muted-foreground">
      <p>출처 · {crumbLabel(story, { kind: 'overview' })} 공개 자료. SKU 매출은 공시 없음.</p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {story.sources.map((s) => (
          <li key={s.href}>
            <a href={s.href} className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
