import Link from 'next/link';
import { DATA_STATE_LABELS, type AnalysisBoardMeta } from '@/lib/analysis';
import { isHiddenBookHref } from '@/lib/hidden-books';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

const STATE_BADGE: Record<AnalysisBoardMeta['dataState'], string> = {
  live: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  partial: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  agent: 'bg-muted text-muted-foreground',
};

export function BoardPageHeader({ board }: { board: AnalysisBoardMeta }) {
  // 숨긴 권으로 가는 딥링크는 404 가 되므로 걸러낸다 — lib/hidden-books.ts
  const textbooks = board.textbooks.filter((t) => !isHiddenBookHref(t.href));

  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {board.step} / {8}
        </span>
        <Badge className={cn(STATE_BADGE[board.dataState])}>
          {DATA_STATE_LABELS[board.dataState]}
        </Badge>
      </div>
      <h1 className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">{board.title}</h1>
      {/* 제목보다 이 질문이 화면의 목적을 말한다. */}
      <p className="mt-1 text-sm text-foreground/80">{board.question}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{board.description}</p>
      {textbooks.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-muted-foreground">교재</span>
          {textbooks.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="text-primary underline-offset-2 hover:underline"
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
