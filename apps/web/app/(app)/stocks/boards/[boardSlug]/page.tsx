import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResearchBoardEditor } from '@/components/research/research-board-editor';
import { getResearchBoard } from '@/lib/platform/research-boards';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  props: PageProps<'/stocks/boards/[boardSlug]'>,
): Promise<Metadata> {
  const { boardSlug } = await props.params;
  const board = await getResearchBoard(boardSlug);
  return { title: board ? board.title : '리서치 보드' };
}

export default async function ResearchBoardPage(props: PageProps<'/stocks/boards/[boardSlug]'>) {
  const { boardSlug } = await props.params;
  const board = await getResearchBoard(boardSlug);
  if (!board || board.theme !== 'stocks') notFound();
  return <ResearchBoardEditor initial={board} />;
}
