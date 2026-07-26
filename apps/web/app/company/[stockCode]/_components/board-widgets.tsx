import Link from 'next/link';
import {
  formatPercent,
  formatWon,
  type AnnualSummary,
  type DartEvent,
  type TrackingFact,
} from '@investment/schema';
import { WIDGETS, type WidgetId } from '@/lib/analysis';
import { WidgetShell } from './widget-shell';
import { TrackingFactList, filterTrackingsByTopics } from './tracking-fact-list';

export type BoardData = {
  annual: AnnualSummary[];
  trackings: TrackingFact[];
  events: DartEvent[];
  cfInvesting: { bsns_year: number; amount: number | null }[];
  stockCode: string;
};

function revenueCagr(annual: AnnualSummary[]): number | null {
  const withRev = annual.filter((r) => r.revenue != null && r.revenue > 0);
  if (withRev.length < 2) return null;
  const first = withRev[0];
  const last = withRev[withRev.length - 1];
  const years = last.bsns_year - first.bsns_year;
  if (years <= 0 || !first.revenue || !last.revenue) return null;
  return (Math.pow(last.revenue / first.revenue, 1 / years) - 1) * 100;
}

function TrackingBoundWidget({
  widgetId,
  data,
  emptyHint,
}: {
  widgetId: WidgetId;
  data: BoardData;
  emptyHint?: string;
}) {
  const meta = WIDGETS[widgetId];
  const facts = filterTrackingsByTopics(data.trackings, meta.trackingTopics);
  const empty = facts.length === 0;
  const latest = facts[facts.length - 1];
  const claim = latest
    ? `${latest.fact}${latest.value_text ? ` (${latest.value_text})` : ''}`
    : meta.claim;
  const evidence = latest
    ? `${latest.source} · ${facts.length}건 시계열`
    : undefined;

  return (
    <WidgetShell
      meta={meta}
      claim={empty ? meta.claim : claim}
      evidence={evidence}
      empty={empty}
      emptyHint={emptyHint ?? '해당 주제 트래킹 사실 없음'}
    >
      <TrackingFactList facts={facts} />
    </WidgetShell>
  );
}

function PlaceholderWidget({
  widgetId,
  emptyHint,
}: {
  widgetId: WidgetId;
  emptyHint?: string;
}) {
  const meta = WIDGETS[widgetId];
  return (
    <WidgetShell meta={meta} empty emptyHint={emptyHint ?? '데이터 없음 / 수집 필요'} />
  );
}

function MarketShareFrameWidget({ data }: { data: BoardData }) {
  const meta = WIDGETS['market-share-frame'];
  const latest = data.annual.length > 0 ? data.annual[data.annual.length - 1] : null;
  const cagr = revenueCagr(data.annual);
  const empty = !latest?.revenue;
  const claim = empty
    ? meta.claim
    : `최근 매출 ${formatWon(latest.revenue)}원${cagr != null ? ` · ${latest.bsns_year - (data.annual[0]?.bsns_year ?? latest.bsns_year)}년 CAGR ${formatPercent(cagr)}` : ''} — 시장×점유율 가정은 별도 입력`;
  const evidence = latest
    ? `공시 연간 요약 ${data.annual[0]?.bsns_year}–${latest.bsns_year}`
    : undefined;

  return (
    <WidgetShell meta={meta} claim={claim} evidence={evidence} empty={empty}>
      {latest && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-fd-muted-foreground">최근 매출</dt>
            <dd className="font-medium tabular-nums">{formatWon(latest.revenue)}원</dd>
          </div>
          <div>
            <dt className="text-xs text-fd-muted-foreground">매출 CAGR</dt>
            <dd className="font-medium tabular-nums">{formatPercent(cagr)}</dd>
          </div>
          <div className="col-span-2 rounded-lg bg-fd-muted/40 px-3 py-2 text-xs text-fd-muted-foreground">
            시장규모·점유율 가정 입력 UI는 후속. 현재는 실적 골격만 표시.
          </div>
        </dl>
      )}
    </WidgetShell>
  );
}

function CfInvestingWidget({ data }: { data: BoardData }) {
  const meta = WIDGETS['cf-investing-notes'];
  const rows = data.cfInvesting.filter((r) => r.amount != null);
  const empty = rows.length === 0;
  const latest = rows[rows.length - 1];
  const revByYear = new Map(data.annual.map((a) => [a.bsns_year, a.revenue]));
  const claim = empty
    ? meta.claim
    : `${latest.bsns_year}년 투자CF ${formatWon(latest.amount)}원`;
  const evidence = empty ? undefined : `financial_metrics · cf_investing · ${rows.length}개년`;

  return (
    <WidgetShell meta={meta} claim={claim} evidence={evidence} empty={empty}>
      <ul className="space-y-1.5 text-sm">
        {rows.slice(-6).map((r) => {
          const rev = revByYear.get(r.bsns_year);
          const pct =
            rev && rev !== 0 && r.amount != null ? (Math.abs(r.amount) / rev) * 100 : null;
          return (
            <li key={r.bsns_year} className="flex items-baseline justify-between gap-2">
              <span className="text-fd-muted-foreground">{r.bsns_year}</span>
              <span className="tabular-nums">
                {formatWon(r.amount)}원
                {pct != null && (
                  <span className="ml-2 text-xs text-fd-muted-foreground">
                    매출 대비 {formatPercent(pct)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}

function KeyFourMetricsWidget({ data }: { data: BoardData }) {
  const meta = WIDGETS['key-four-metrics'];
  const empty = data.annual.length === 0;
  const latest = empty ? null : data.annual[data.annual.length - 1];
  const cagr = revenueCagr(data.annual);
  const claim = latest
    ? `${latest.bsns_year}년 기준 매출성장·OPM·ROE·부채`
    : meta.claim;
  const evidence = latest
    ? `연간 요약 ${data.annual[0].bsns_year}–${latest.bsns_year}`
    : undefined;

  return (
    <WidgetShell meta={meta} claim={claim} evidence={evidence} empty={empty}>
      {latest && (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            { label: '매출 CAGR', value: formatPercent(cagr) },
            { label: '영업이익률', value: formatPercent(latest.opm_pct) },
            { label: 'ROE', value: formatPercent(latest.roe_pct) },
            { label: '부채비율', value: formatPercent(latest.debt_ratio_pct) },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-fd-muted-foreground">{item.label}</dt>
              <dd className="font-semibold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {data.annual.length > 1 && (
        <ul className="mt-3 space-y-1 border-t border-fd-border pt-3 text-xs text-fd-muted-foreground">
          {data.annual.slice(-5).map((r) => (
            <li key={r.bsns_year} className="flex justify-between gap-2">
              <span>{r.bsns_year}</span>
              <span className="tabular-nums">
                매출 {formatWon(r.revenue)} · OPM {formatPercent(r.opm_pct)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function MarginThreeLayersWidget({ data }: { data: BoardData }) {
  const meta = WIDGETS['margin-three-layers'];
  const facts = filterTrackingsByTopics(data.trackings, meta.trackingTopics);
  const withOpm = data.annual.filter((r) => r.opm_pct != null);
  const empty = withOpm.length === 0 && facts.length === 0;
  const latest = withOpm[withOpm.length - 1];
  const prev = withOpm.length > 1 ? withOpm[withOpm.length - 2] : null;
  let claim = meta.claim;
  if (latest && prev && latest.opm_pct != null && prev.opm_pct != null) {
    const delta = latest.opm_pct - prev.opm_pct;
    claim = `OPM ${formatPercent(prev.opm_pct)} → ${formatPercent(latest.opm_pct)} (${delta >= 0 ? '+' : ''}${formatPercent(delta)}) — 3층 분해는 트래킹·가동률 보강 필요`;
  } else if (latest) {
    claim = `최근 OPM ${formatPercent(latest.opm_pct)} — 가동률·원자재·가격결정권 층위는 추가 수집`;
  }

  return (
    <WidgetShell
      meta={meta}
      claim={claim}
      evidence={
        latest
          ? `공시 OPM · 이익률-구조 트래킹 ${facts.length}건`
          : undefined
      }
      empty={empty}
    >
      {withOpm.length > 0 && (
        <ul className="mb-3 space-y-1 text-sm">
          {withOpm.slice(-5).map((r) => (
            <li key={r.bsns_year} className="flex justify-between">
              <span className="text-fd-muted-foreground">{r.bsns_year}</span>
              <span className="tabular-nums">{formatPercent(r.opm_pct)}</span>
            </li>
          ))}
        </ul>
      )}
      {facts.length > 0 && <TrackingFactList facts={facts} limit={5} />}
    </WidgetShell>
  );
}

function ResourceAllocationWidget({ data }: { data: BoardData }) {
  const meta = WIDGETS['resource-allocation'];
  const rows = data.cfInvesting.filter((r) => r.amount != null);
  const revByYear = new Map(data.annual.map((a) => [a.bsns_year, a.revenue]));
  const facts = filterTrackingsByTopics(data.trackings, meta.trackingTopics);
  const hasCapex = rows.length > 0;
  const empty = !hasCapex && facts.length === 0;
  const latest = rows[rows.length - 1];
  const latestRev = latest ? revByYear.get(latest.bsns_year) : null;
  const pct =
    latest && latestRev && latestRev !== 0 && latest.amount != null
      ? (Math.abs(latest.amount) / latestRev) * 100
      : null;

  const claim = hasCapex
    ? `투자CF가 매출의 ${pct != null ? formatPercent(pct) : '—'} — 매출원가·판관·인건 비중은 수집 후 합산`
    : meta.claim;

  return (
    <WidgetShell
      meta={meta}
      claim={claim}
      evidence={hasCapex ? `투자CF ${rows.length}개년 · 트래킹 ${facts.length}건` : undefined}
      empty={empty}
      emptyHint="매출원가·판관·인건·CAPEX 매출 대비 비중 수집 필요"
    >
      {hasCapex && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium text-fd-muted-foreground">
            CAPEX 대리(투자활동CF) / 매출
          </p>
          <ul className="space-y-1 text-sm">
            {rows.slice(-5).map((r) => {
              const rev = revByYear.get(r.bsns_year);
              const p =
                rev && rev !== 0 && r.amount != null
                  ? (Math.abs(r.amount) / rev) * 100
                  : null;
              return (
                <li key={r.bsns_year} className="flex justify-between gap-2">
                  <span className="text-fd-muted-foreground">{r.bsns_year}</span>
                  <span className="tabular-nums">
                    {formatWon(r.amount)}원
                    {p != null && (
                      <span className="ml-2 text-xs text-fd-muted-foreground">
                        {formatPercent(p)}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {facts.length > 0 && <TrackingFactList facts={facts} limit={4} />}
      <p className="mt-2 text-[11px] text-fd-muted-foreground">
        판관·인건·R&D 계정은 후속 ingest. 지금은 투자 집행으로 자원 배분 방향을 본다.
      </p>
    </WidgetShell>
  );
}

function OrgPeopleDecisionWidget({ data }: { data: BoardData }) {
  const meta = WIDGETS['org-people-decision'];
  const facts = filterTrackingsByTopics(data.trackings, meta.trackingTopics);
  const empty = facts.length === 0;
  const latest = facts[facts.length - 1];

  return (
    <WidgetShell
      meta={meta}
      claim={latest ? latest.fact : meta.claim}
      evidence={latest ? `${latest.source} · ${facts.length}건` : undefined}
      empty={empty}
      emptyHint="인원·근속·인건비/매출 및 조직 변경 사실 수집 필요"
    >
      <TrackingFactList facts={facts} />
      <p className="mt-2 text-[11px] text-fd-muted-foreground">
        사업보고서 인력 주석·인건비 계정 연동은 후속.
      </p>
    </WidgetShell>
  );
}

function EventsBoundWidget({
  widgetId,
  data,
  eventTypeIncludes,
  emptyHint,
}: {
  widgetId: WidgetId;
  data: BoardData;
  eventTypeIncludes: string[];
  emptyHint?: string;
}) {
  const meta = WIDGETS[widgetId];
  const facts = filterTrackingsByTopics(data.trackings, meta.trackingTopics);
  const events = data.events.filter((e) =>
    eventTypeIncludes.some((k) => e.event_type.includes(k)),
  );
  const empty = facts.length === 0 && events.length === 0;
  const latestFact = facts[facts.length - 1];
  const latestEvent = events[0];
  const claim = latestFact
    ? latestFact.fact
    : latestEvent
      ? `${latestEvent.event_type} (${latestEvent.rcept_dt ?? '일자 미상'})`
      : meta.claim;

  return (
    <WidgetShell
      meta={meta}
      claim={claim}
      evidence={
        empty
          ? undefined
          : `트래킹 ${facts.length}건 · 이벤트 ${events.length}건`
      }
      empty={empty}
      emptyHint={emptyHint}
    >
      {facts.length > 0 && <TrackingFactList facts={facts} limit={5} />}
      {events.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-sm">
          {events.slice(0, 5).map((e) => (
            <li key={e.id} className="flex justify-between gap-2 text-xs">
              <span className="text-fd-muted-foreground">{e.rcept_dt ?? '—'}</span>
              <span className="text-right">{e.event_type}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function StudyLinksWidget() {
  const meta = WIDGETS['study-links'];
  return (
    <WidgetShell meta={meta} claim={meta.claim} evidence="교재 딥링크">
      <ul className="space-y-2 text-sm">
        {[
          { href: '/docs/book2', label: '2권 이차전지 산업을 해부하는 법' },
          { href: '/docs/book2/D1', label: '밸류체인 지도와 채찍효과' },
          { href: '/docs/book2/A2', label: '이차전지 개념과 구성' },
          { href: '/docs/book2/A3', label: '에너지밀도와 하이니켈' },
          { href: '/docs/book1/B3', label: '1권 산업 분석 프레임' },
        ].map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-fd-primary underline-offset-2 hover:underline"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

function AgentChatWidget({ stockCode }: { stockCode: string }) {
  const meta = WIDGETS['agent-chat'];
  return (
    <WidgetShell
      meta={meta}
      claim={`종목 ${stockCode} 분석 화면 맥락으로 질문할 수 있게 됩니다`}
      evidence="UI 골격 · LLM 백엔드 후속"
    >
      <div className="rounded-lg border border-dashed border-fd-border bg-fd-muted/30 p-4">
        <p className="text-sm text-fd-muted-foreground">
          AI는 보조입니다. 위젯 근거 설명·트래킹 사실 고르기 제안만 하며, 분석 화면
          레이아웃은 바꾸지 않습니다.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            disabled
            placeholder="예: 수주 위젯 근거를 설명해줘"
            className="flex-1 rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm opacity-60"
          />
          <button
            type="button"
            disabled
            className="rounded-md bg-fd-primary px-3 py-2 text-sm font-medium text-fd-primary-foreground opacity-50"
          >
            보내기
          </button>
        </div>
      </div>
    </WidgetShell>
  );
}

export function renderBoardWidget(widgetId: WidgetId, data: BoardData) {
  switch (widgetId) {
    case 'market-share-frame':
      return <MarketShareFrameWidget key={widgetId} data={data} />;
    case 'capa-to-revenue':
    case 'order-contract-signal':
    case 'capex-execution':
    case 'segment-mix':
      return <TrackingBoundWidget key={widgetId} data={data} widgetId={widgetId} />;
    case 'news-yt-facts':
      return (
        <PlaceholderWidget
          key={widgetId}
          widgetId={widgetId}
          emptyHint="뉴스·유튜브 팩트 파이프라인 후속"
        />
      );
    case 'cf-investing-notes':
      return <CfInvestingWidget key={widgetId} data={data} />;
    case 'key-four-metrics':
      return <KeyFourMetricsWidget key={widgetId} data={data} />;
    case 'margin-three-layers':
      return <MarginThreeLayersWidget key={widgetId} data={data} />;
    case 'resource-allocation':
      return <ResourceAllocationWidget key={widgetId} data={data} />;
    case 'org-people-decision':
      return <OrgPeopleDecisionWidget key={widgetId} data={data} />;
    case 'major-shareholder':
      return (
        <EventsBoundWidget
          key={widgetId}
          widgetId={widgetId}
          data={data}
          eventTypeIncludes={['대량보유', '임원ㆍ주요주주', '주식등의대량']}
          emptyHint="대주주·지분 트래킹/공시 없음"
        />
      );
    case 'dilution-funding':
      return (
        <EventsBoundWidget
          key={widgetId}
          widgetId={widgetId}
          data={data}
          eventTypeIncludes={['유상증자', '전환사채', '신주인수권', 'BW', 'CB']}
          emptyHint="자금조달·희석 관련 공시/트래킹 없음"
        />
      );
    case 'treasury-return':
      return (
        <EventsBoundWidget
          key={widgetId}
          widgetId={widgetId}
          data={data}
          eventTypeIncludes={['자기주식', '자사주', '배당']}
          emptyHint="자사주·환원 관련 공시/트래킹 없음"
        />
      );
    case 'ma-org':
      return (
        <EventsBoundWidget
          key={widgetId}
          widgetId={widgetId}
          data={data}
          eventTypeIncludes={['합병', '양수', '양도', '영업양수', '분할']}
          emptyHint="M&A·조직 관련 공시/트래킹 없음"
        />
      );
    case 'management-talent':
      return (
        <TrackingBoundWidget
          key={widgetId}
          data={data}
          widgetId={widgetId}
          emptyHint="경영진·핵심인재 트래킹 없음"
        />
      );
    case 'people-profile':
      return (
        <PlaceholderWidget
          key={widgetId}
          widgetId={widgetId}
          emptyHint="링크드인 등 2차 프로필 수집 후속"
        />
      );
    case 'value-chain-map':
    case 'scorecard':
    case 'phase-three-qs':
    case 'bullwhip-cycle':
      return (
        <PlaceholderWidget
          key={widgetId}
          widgetId={widgetId}
          emptyHint="산업 분석 데이터·지도는 후속. 교재 링크를 참고하세요."
        />
      );
    case 'study-links':
      return <StudyLinksWidget key={widgetId} />;
    case 'agent-chat':
      return <AgentChatWidget key={widgetId} stockCode={data.stockCode} />;
    default:
      return <PlaceholderWidget key={widgetId} widgetId={widgetId} />;
  }
}

export function WidgetGrid({
  widgetIds,
  data,
}: {
  widgetIds: WidgetId[];
  data: BoardData;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {widgetIds.map((id) => renderBoardWidget(id, data))}
    </div>
  );
}
