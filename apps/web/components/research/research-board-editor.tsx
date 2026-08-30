'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteResearchBoardAction, saveResearchBoardAction } from '@/lib/research/actions';
import { addGroup } from '@/lib/research/document';
import type { ResearchBoard } from '@/lib/research/types';
import { researchBoardsHref } from '@/lib/nav';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ResearchBoardCanvas, ResearchBoardToolbar } from '@/components/research/research-board';

type SaveState = 'saved' | 'saving' | 'error';

export function ResearchBoardEditor({ initial }: { initial: ResearchBoard }) {
  const router = useRouter();
  const [board, setBoard] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(board);
  latest.current = board;

  useEffect(() => {
    setBoard(initial);
    setSaveState('saved');
    setError(null);
  }, [initial.slug]);

  const persist = useCallback(async (next: ResearchBoard) => {
    setSaveState('saving');
    const result = await saveResearchBoardAction(next);
    if (result.ok) {
      setSaveState('saved');
      setError(null);
    } else {
      setSaveState('error');
      setError(result.error);
    }
  }, []);

  const onChange = useCallback(
    (next: ResearchBoard) => {
      setBoard(next);
      latest.current = next;
      setSaveState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void persist(next);
      }, 400);
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function onDelete() {
    const result = await deleteResearchBoardAction(board.slug, board.theme);
    if (!result.ok) {
      setError(result.error);
      setSaveState('error');
      return;
    }
    router.push(researchBoardsHref(board.theme));
  }

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-6 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">리서치 보드</p>
          <input
            className="mt-2 w-full bg-transparent text-2xl font-semibold tracking-tight outline-none"
            value={board.title}
            aria-label="보드 제목"
            onChange={(event) => onChange({ ...board, title: event.target.value })}
          />
          <input
            className="mt-1 w-full max-w-3xl bg-transparent text-sm text-muted-foreground outline-none"
            value={board.tagline}
            aria-label="보드 설명"
            placeholder="보드 설명"
            onChange={(event) => onChange({ ...board, tagline: event.target.value })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {saveState === 'saving' && '저장 중'}
            {saveState === 'saved' && '저장됨'}
            {saveState === 'error' && (error ?? '저장 실패')}
          </p>
          <ResearchBoardToolbar onAddGroup={() => onChange(addGroup(board))} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            보드 삭제
          </Button>
        </div>
      </header>
      <ResearchBoardCanvas board={board} onChange={onChange} />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 보드를 삭제할까요?</DialogTitle>
            <DialogDescription>그룹과 칸이 함께 지워집니다. 되돌릴 수 없습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
            <Button type="button" variant="destructive" onClick={() => void onDelete()}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
