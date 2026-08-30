import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResearchBoardCanvas } from '@/components/research/research-board';
import { getResearchBoard } from '@/lib/research';

export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<'/stocks/boards/[boardSlug]'>,
): Promise<Metadata> {
  const { boardSlug } = await props.params;
  const board = getResearchBoard(boardSlug);
  return { title: board ? board.title : '리서치 보드' };
}

export default async function ResearchBoardPage(props: PageProps<'/stocks/boards/[boardSlug]'>) {
  const { boardSlug } = await props.params;
  const board = getResearchBoard(boardSlug);
  if (!board) notFound();
  return <ResearchBoardCanvas board={board} />;
}
