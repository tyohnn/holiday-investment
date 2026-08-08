import { notFound } from 'next/navigation';
import { getBoard, type BoardId } from '@/lib/analysis';
import { getCompanyPageData } from '@/lib/platform/db';
import { AgentCta } from './agent-cta';
import { BoardPageHeader } from './board-page-header';
import { WidgetGrid } from './board-widgets';
import { CompanyHeader } from './company-header';
import { CorrectionChains } from './correction-chains';
import { EventsSection } from './events-section';
import { FilingTimeline } from './filing-timeline';
import { FinancialChart } from './financial-chart';
import { KeyMetrics } from './key-metrics';
import { SectionsList } from './sections-list';
import { TrackingTimeline } from './tracking-timeline';
import { ValuationBoard } from './valuation-board';
import { VerdictBoard } from './verdict-board';

/**
 * 8단계 논증 화면의 공통 렌더러.
 *
 * 보드마다 page.tsx 를 따로 두되(Next 라우팅 요구), 내용은 여기 한 곳에서 갈린다 —
 * 여덟 개의 거의 같은 파일이 각자 조금씩 어긋나는 걸 막는다.
 */
export async function BoardScreen({
  stockCode,
  boardId,
}: {
  stockCode: string;
  boardId: BoardId;
}) {
  const board = getBoard(boardId);
  const data = await getCompanyPageData(stockCode);
  if (!data) notFound();

  const { company, annual, filings, corrections, events, trackings, sections } = data;
  const latestYear = annual.length > 0 ? annual[annual.length - 1] : null;
  const previousYear = annual.length > 1 ? annual[annual.length - 2] : null;

  const boardData = {
    annual,
    trackings,
    events,
    ownershipTxns: data.ownershipTxns,
    themedFilings: data.themedFilings,
    cfInvesting: data.cfInvesting,
    stockCode,
  };

  return (
    <div className="space-y-8 pb-16">
      <BoardPageHeader board={board} />

      {/* 정성 단계는 빈 위젯 격자만 보여주는 대신, 무엇이 채워질지부터 말한다. */}
      {board.dataState === 'agent' && <AgentCta board={board} />}

      {boardId === 'primary' && (
        <>
          <CompanyHeader company={company} />
          {latestYear && <KeyMetrics latest={latestYear} previous={previousYear} />}
          {annual.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">재무 추이</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                연도별 매출·영업이익(막대, 좌축) · 영업이익률(선, 우축) —{' '}
                {annual[0].bsns_year}~{annual[annual.length - 1].bsns_year}
              </p>
              <div className="mt-3 rounded-xl border border-border bg-card p-4">
                <FinancialChart data={annual} />
              </div>
            </section>
          )}
        </>
      )}

      {/* 판정은 종목 진입점이다 — 위젯 골격보다 답이 먼저 와야 한다. */}
      {boardId === 'verdict' && <VerdictBoard stockCode={stockCode} annual={annual} />}

      {/* 밸류에이션은 9칸이 주인공이라 위젯 격자보다 먼저 온다. */}
      {boardId === 'valuation' && <ValuationBoard stockCode={stockCode} annual={annual} />}

      {board.widgets.length > 0 && <WidgetGrid widgetIds={board.widgets} data={boardData} />}

      {boardId === 'primary' && (
        <>
          <TrackingTimeline trackings={trackings} />
          <SectionsList stockCode={stockCode} sections={sections} />
          <FilingTimeline filings={filings} />
          <CorrectionChains corrections={corrections} />
          <EventsSection events={events} />
        </>
      )}
    </div>
  );
}
