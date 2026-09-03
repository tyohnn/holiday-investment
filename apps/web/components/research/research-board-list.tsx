'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createResearchBoardAction } from '@/lib/research/actions';
import type { ResearchBoard, ResearchBoardTheme } from '@/lib/research/types';
import { getTheme, researchBoardHref } from '@/lib/nav';
import { Button } from '@/components/ui/button';

export function ResearchBoardList({
  theme,
  boards,
}: {
  theme: ResearchBoardTheme;
  boards: ResearchBoard[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const themeLabel = getTheme(theme).label;

  async function onCreate() {
    setPending(true);
    setError(null);
    const result = await createResearchBoardAction(theme);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(researchBoardHref(result.board.slug, theme));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">{themeLabel}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">리서치 보드</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            그룹이 슬라이드입니다. 툴바로 넘기면 카메라가 그 그룹으로 이동합니다.
          </p>
        </div>
        <Button type="button" size="sm" disabled={pending} onClick={() => void onCreate()}>
          {pending ? '만드는 중' : '새 보드'}
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {boards.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">아직 보드가 없습니다. 새 보드로 시작하세요.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {boards.map((board) => (
            <li key={board.slug}>
              <Link
                href={researchBoardHref(board.slug, theme)}
                className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
              >
                <h2 className="font-semibold">{board.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{board.tagline || '설명 없음'}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  그룹 {board.groups.length}개
                  {board.groups.length > 0 && ` · ${board.groups.map((group) => group.title).join(' · ')}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
