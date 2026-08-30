import type { Metadata } from 'next';
import Link from 'next/link';
import { researchBoardHref } from '@/lib/nav';
import { listResearchBoards } from '@/lib/research';

export const metadata: Metadata = {
  title: '리서치 보드',
};

export default function ResearchBoardListPage() {
  const boards = listResearchBoards();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">주식</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">리서치 보드</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        차트와 뉴스를 주제 그룹으로 감싼 보드입니다. 그룹 안 칸은 드래그·리사이즈로 옮깁니다.
      </p>

      <ul className="mt-8 space-y-3">
        {boards.map((board) => (
          <li key={board.slug}>
            <Link
              href={researchBoardHref(board.slug)}
              className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
            >
              <h2 className="font-semibold">{board.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{board.tagline}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                그룹 {board.groups.length}개
                {board.groups.length > 0 && ` · ${board.groups.map((g) => g.title).join(' · ')}`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
