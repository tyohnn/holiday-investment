import type { Metadata } from 'next';
import { getBoard } from '@/lib/analysis';
import { BoardScreen } from '../_components/board-screen';

export const revalidate = 0;

const board = getBoard('verdict');

export async function generateMetadata(
  props: PageProps<'/lab/[stockCode]/verdict'>,
): Promise<Metadata> {
  const { stockCode } = await props.params;
  return { title: `${board.title} · ${stockCode}` };
}

export default async function Page(props: PageProps<'/lab/[stockCode]/verdict'>) {
  const { stockCode } = await props.params;
  return <BoardScreen stockCode={stockCode} boardId={board.id} />;
}
