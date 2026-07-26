import type { AnalysisBoardMeta } from '@/lib/analysis';

export function BoardPageHeader({ board }: { board: AnalysisBoardMeta }) {
  return (
    <header className="mb-6">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{board.title}</h1>
      <p className="mt-1 text-sm text-fd-muted-foreground">{board.description}</p>
    </header>
  );
}
