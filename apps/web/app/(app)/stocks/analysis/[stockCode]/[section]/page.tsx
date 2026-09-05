import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBoardBySlug } from '@/lib/analysis';
import { getCompanyMenuBySlug } from '@/lib/company';
import { GuidePage } from '@/app/(app)/company/[stockCode]/_components/guide-page';
import { BoardScreen } from '@/app/(app)/lab/[stockCode]/_components/board-screen';

export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<'/stocks/analysis/[stockCode]/[section]'>,
): Promise<Metadata> {
  const { stockCode, section } = await props.params;
  const menu = getCompanyMenuBySlug(section);
  if (menu) return { title: `${menu.title} · ${stockCode}` };
  const board = getBoardBySlug(section);
  if (board) return { title: `${board.title} · ${stockCode}` };
  return { title: stockCode };
}

export default async function AnalysisSectionPage(
  props: PageProps<'/stocks/analysis/[stockCode]/[section]'>,
) {
  const { stockCode, section } = await props.params;
  const menu = getCompanyMenuBySlug(section);
  if (menu) return <GuidePage stockCode={stockCode} menuId={menu.id} />;
  const board = getBoardBySlug(section);
  if (board) return <BoardScreen stockCode={stockCode} boardId={board.id} />;
  notFound();
}
