import type { Metadata } from 'next';
import { ResearchBoardList } from '@/components/research/research-board-list';
import { listResearchBoards } from '@/lib/platform/research-boards';

export const metadata: Metadata = { title: '리서치 보드 · 부동산' };

export const dynamic = 'force-dynamic';

export default async function Page() {
  const boards = await listResearchBoards('real-estate');
  return <ResearchBoardList theme="real-estate" boards={boards} />;
}
