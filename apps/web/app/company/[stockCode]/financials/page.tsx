import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBoard } from '@/lib/analysis';
import { getCompanyPageData } from '@/lib/platform/db';
import { BoardPageHeader } from '../_components/board-page-header';
import { CompanyHeader } from '../_components/company-header';
import { FinancialChart } from '../_components/financial-chart';
import { KeyMetrics } from '../_components/key-metrics';
import { TrackingTimeline } from '../_components/tracking-timeline';
import { FilingTimeline } from '../_components/filing-timeline';
import { CorrectionChains } from '../_components/correction-chains';
import { EventsSection } from '../_components/events-section';
import { SectionsList } from '../_components/sections-list';

export const revalidate = 0;

const board = getBoard('financials');

export async function generateMetadata(
  props: PageProps<'/company/[stockCode]/financials'>,
): Promise<Metadata> {
  const { stockCode } = await props.params;
  return { title: `${board.title} · ${stockCode}` };
}

export default async function FinancialsSourcePage(
  props: PageProps<'/company/[stockCode]/financials'>,
) {
  const { stockCode } = await props.params;
  const data = await getCompanyPageData(stockCode);
  if (!data) notFound();

  const { company, annual, filings, corrections, events, trackings, sections } = data;
  const latestYear = annual.length > 0 ? annual[annual.length - 1] : null;

  return (
    <div className="space-y-8 pb-16">
      <BoardPageHeader board={board} />
      <CompanyHeader company={company} />

      {latestYear && <KeyMetrics latest={latestYear} />}

      {annual.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold">재무 추이</h2>
          <p className="mt-1 text-xs text-fd-muted-foreground">
            연도별 매출·영업이익(막대, 좌축) · 영업이익률(선, 우축) — {annual[0].bsns_year}~
            {annual[annual.length - 1].bsns_year}
          </p>
          <div className="mt-3 rounded-xl border border-fd-border bg-fd-card p-4">
            <FinancialChart data={annual} />
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-fd-border p-6 text-center text-sm text-fd-muted-foreground">
          재무 데이터 없음
        </p>
      )}

      <TrackingTimeline trackings={trackings} />
      <SectionsList stockCode={stockCode} sections={sections} />
      <FilingTimeline filings={filings} />
      <CorrectionChains corrections={corrections} />
      <EventsSection events={events} />
    </div>
  );
}
