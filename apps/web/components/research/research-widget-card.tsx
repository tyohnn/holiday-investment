'use client';

import Link from 'next/link';
import { DotsSixVerticalIcon, TrashIcon } from '@phosphor-icons/react';
import type { ResearchBoard, ResearchWidget } from '@/lib/research';
import { moveWidget, removeWidget, renameWidget } from '@/lib/research/document';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export const WIDGET_MIME = 'text/research-widget';

export function ResearchWidgetCard({
  board,
  groupId,
  widget,
  onChange,
  showGridHandle,
}: {
  board: ResearchBoard;
  groupId: string;
  widget: ResearchWidget;
  onChange: (next: ResearchBoard) => void;
  showGridHandle: boolean;
}) {
  const otherGroups = board.groups.filter((group) => group.id !== groupId);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background">
      <header className="flex items-start gap-2 border-b border-border px-2.5 py-1.5">
        {showGridHandle && (
          <button
            type="button"
            className="research-widget-drag mt-0.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label="위젯 위치 이동"
          >
            <DotsSixVerticalIcon className="size-4" />
          </button>
        )}
        <button
          type="button"
          draggable
          className="mt-0.5 cursor-grab text-[10px] text-muted-foreground hover:text-foreground"
          aria-label="다른 그룹으로 끌기"
          title="다른 그룹으로 끌기"
          onDragStart={(event) => {
            event.dataTransfer.setData(WIDGET_MIME, widget.id);
            event.dataTransfer.effectAllowed = 'move';
          }}
        >
          ⇄
        </button>
        <div className="min-w-0 flex-1">
          <input
            className="w-full truncate bg-transparent text-sm font-semibold outline-none"
            value={widget.title}
            aria-label="위젯 제목"
            onChange={(event) => onChange(renameWidget(board, widget.id, { title: event.target.value }))}
          />
          {widget.source && (
            <p className="truncate text-[11px] text-muted-foreground">{widget.source}</p>
          )}
        </div>
        {otherGroups.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="xs">
                그룹
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="end">
              <Command>
                <CommandList>
                  <CommandEmpty>다른 그룹 없음</CommandEmpty>
                  <CommandGroup heading="이 칸을 옮길 그룹">
                    {otherGroups.map((group) => (
                      <CommandItem
                        key={group.id}
                        value={group.title}
                        onSelect={() => onChange(moveWidget(board, widget.id, group.id))}
                      >
                        {group.title || '이름 없는 그룹'}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="위젯 삭제"
          onClick={() => onChange(removeWidget(board, widget.id))}
        >
          <TrashIcon className="size-3.5" />
        </Button>
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
            widget.kind === 'news' && 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
            widget.kind === 'note' && 'bg-muted text-muted-foreground',
            widget.kind === 'metric' && 'bg-primary/10 text-primary',
            widget.kind === 'link' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            widget.kind === 'chart' && 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
          )}
        >
          {kindLabel(widget.kind)}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-2.5 py-2 text-sm">
        {widget.kind === 'metric' && widget.metric && (
          <div>
            <p className="text-2xl font-semibold tracking-tight">{widget.metric.value}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {widget.metric.caption}
            </p>
          </div>
        )}
        {widget.kind === 'note' ? (
          <textarea
            className="min-h-16 w-full resize-none bg-transparent text-xs leading-relaxed text-muted-foreground outline-none"
            value={widget.body ?? ''}
            placeholder="메모"
            onChange={(event) => onChange(renameWidget(board, widget.id, { body: event.target.value }))}
          />
        ) : (
          widget.body && <p className="text-xs leading-relaxed text-muted-foreground">{widget.body}</p>
        )}
        {widget.items && widget.items.length > 0 && (
          <ul className="space-y-2">
            {widget.items.map((item) => (
              <li key={item.title} className="rounded-lg bg-muted/50 px-2.5 py-2">
                {item.href ? (
                  <Link href={item.href} className="text-xs font-medium text-primary hover:underline">
                    {item.title}
                  </Link>
                ) : (
                  <p className="text-xs font-medium">{item.title}</p>
                )}
                {item.note && (
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {widget.href && (
          <Link
            href={widget.href}
            className="mt-2 inline-flex text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {widget.hrefLabel ?? '열기'}
          </Link>
        )}
      </div>
    </article>
  );
}

export function kindLabel(kind: ResearchWidget['kind']): string {
  switch (kind) {
    case 'chart':
      return '차트';
    case 'news':
      return '뉴스';
    case 'note':
      return '노트';
    case 'metric':
      return '지표';
    case 'link':
      return '링크';
  }
}
