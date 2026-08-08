import type { Metadata } from 'next';
import { getBoard } from '@/lib/analysis';
import { BoardScreen } from '../_components/board-screen';

export const revalidate = 0;

const board = getBoard('industry');

export async function generateMetadata(
  props: PageProps<'/lab/[stockCode]/industry'>,
): Promise<Metadata> {
  const { stockCode } = await props.params;
  return { title: `${board.title} · ${stockCode}` };
}

export default async function IndustryBoardPage(
  props: PageProps<'/lab/[stockCode]/industry'>,
) {
  const { stockCode } = await props.params;
  return <BoardScreen stockCode={stockCode} boardId={board.id} />;
}
