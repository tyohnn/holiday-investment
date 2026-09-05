'use server';

import { revalidatePath } from 'next/cache';
import {
  createResearchBoard as insertBoard,
  deleteResearchBoard as removeBoard,
  upsertResearchBoard,
} from '@/lib/platform/research-boards';
import { emptyBoard } from '@/lib/research/document';
import type { ResearchBoard, ResearchBoardTheme } from '@/lib/research/types';

export type BoardActionResult =
  | { ok: true; board: ResearchBoard }
  | { ok: false; error: string };

function revalidateBoard(board: Pick<ResearchBoard, 'theme' | 'slug'>) {
  revalidatePath(`/${board.theme}/boards`);
  revalidatePath(`/${board.theme}/boards/${board.slug}`);
}

export async function createResearchBoardAction(
  theme: ResearchBoardTheme,
  title?: string,
): Promise<BoardActionResult> {
  try {
    const board = await insertBoard(emptyBoard(theme, title ?? '새 보드'));
    revalidateBoard(board);
    return { ok: true, board };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '보드를 만들지 못했습니다.' };
  }
}

export async function saveResearchBoardAction(board: ResearchBoard): Promise<BoardActionResult> {
  try {
    const saved = await upsertResearchBoard(board);
    revalidateBoard(saved);
    return { ok: true, board: saved };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '보드를 저장하지 못했습니다.' };
  }
}

export async function deleteResearchBoardAction(
  slug: string,
  theme: ResearchBoardTheme,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await removeBoard(slug);
    revalidatePath(`/${theme}/boards`);
    revalidatePath(`/${theme}/boards/${slug}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '보드를 삭제하지 못했습니다.' };
  }
}
