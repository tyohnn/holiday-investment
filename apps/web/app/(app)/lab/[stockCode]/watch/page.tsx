import type { Metadata } from 'next';
import { getBoard } from '@/lib/analysis';
import { BoardScreen } from '../_components/board-screen';

export const revalidate = 0;

const board = getBoard('watch');

export async function generateMetadata(
  props: PageProps<'/lab/[stockCode]/watch'>,
): Promise<Metadata> {
  const { stockCode } = await props.params;
  return { title: `${board.title} · ${stockCode}` };
}

export default async function Page(props: PageProps<'/lab/[stockCode]/watch'>) {
  const { stockCode } = await props.params;
  return <BoardScreen stockCode={stockCode} boardId={board.id} />;
}
