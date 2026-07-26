import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBoard } from '@/lib/analysis';
import { getCompanyPageData } from '@/lib/platform/db';
import { BoardPageHeader } from '../_components/board-page-header';
import { WidgetGrid } from '../_components/board-widgets';

export const revalidate = 0;

const board = getBoard('industry');

export async function generateMetadata(
  props: PageProps<'/company/[stockCode]/industry'>,
): Promise<Metadata> {
  const { stockCode } = await props.params;
  return { title: `${board.title} · ${stockCode}` };
}

export default async function IndustryBoardPage(
  props: PageProps<'/company/[stockCode]/industry'>,
) {
  const { stockCode } = await props.params;
  const data = await getCompanyPageData(stockCode);
  if (!data) notFound();

  return (
    <div className="pb-16">
      <BoardPageHeader board={board} />
      <WidgetGrid
        widgetIds={board.widgets}
        data={{
          annual: data.annual,
          trackings: data.trackings,
          events: data.events,
          cfInvesting: data.cfInvesting,
          stockCode,
        }}
      />
    </div>
  );
}
