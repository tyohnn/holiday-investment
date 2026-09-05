import type { Metadata } from 'next';
import { ResearchBoardList } from '@/components/research/research-board-list';
import { listResearchBoards } from '@/lib/platform/research-boards';

export const metadata: Metadata = {
  title: '리서치 보드',
};

export const dynamic = 'force-dynamic';

export default async function ResearchBoardListPage() {
  const boards = await listResearchBoards('stocks');
  return <ResearchBoardList theme="stocks" boards={boards} />;
}
