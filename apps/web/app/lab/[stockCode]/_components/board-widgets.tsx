import {
  formatPercent,
  formatWon,
  readOwnership,
  OWNERSHIP_KIND_LABELS,
  type AnnualSummary,
  type DartEvent,
  type Filing,
  type OwnershipTxn,
  type TrackingFact,
} from '@investment/schema';
import { WIDGETS, type WidgetId } from '@/lib/analysis';
import { StaggerReveal } from '@/lib/motion/stagger-reveal';
import { WidgetShell } from './widget-shell';
import { TrackingFactList, filterTrackingsByTopics } from './tracking-fact-list';

export type BoardData = {
  annual: AnnualSummary[];
  trackings: TrackingFact[];
  events: DartEvent[];
  /** 지분 변동 원장 — `events` 에 없는 사실이라 별도 소스다. */
  ownershipTxns: OwnershipTxn[];
  /** 지분·배당·자사주 주제어로 긁은 공시 목록 (report_nm 매칭). */
  themedFilings: Filing[];
  cfInvesting: { bsns_year: number; amount: number | null }[];
  stockCode: string;
};

/** report_nm 부분일치 — `events.event_type` 에 없는 주제를 공시 목록에서 집는다. */
function filterFilingsByName(filings: Filing[], includes: string[]): Filing[] {
  return filings.filter((f) => includes.some((k) => f.report_nm.includes(k)));
}

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
            <dt className="text-xs text-muted-foreground">최근 매출</dt>
            <dd className="font-medium tabular-nums">{formatWon(latest.revenue)}원</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">매출 CAGR</dt>
            <dd className="font-medium tabular-nums">{formatPercent(cagr)}</dd>
          </div>
          <div className="col-span-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
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
  const evidence = empty ? undefined : `fin_periods · cf_investing · ${rows.length}개년`;

  return (
    <WidgetShell meta={meta} claim={claim} evidence={evidence} empty={empty}>
      <ul className="space-y-1.5 text-sm">
        {rows.slice(-6).map((r) => {
          const rev = revByYear.get(r.bsns_year);
          const pct =
            rev && rev !== 0 && r.amount != null ? (Math.abs(r.amount) / rev) * 100 : null;
          return (
            <li key={r.bsns_year} className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{r.bsns_year}</span>
              <span className="tabular-nums">
                {formatWon(r.amount)}원
                {pct != null && (
                  <span className="ml-2 text-xs text-muted-foreground">
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
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="font-semibold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {data.annual.length > 1 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
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
              <span className="text-muted-foreground">{r.bsns_year}</span>
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
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
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
                  <span className="text-muted-foreground">{r.bsns_year}</span>
                  <span className="tabular-nums">
                    {formatWon(r.amount)}원
                    {p != null && (
                      <span className="ml-2 text-xs text-muted-foreground">
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
      <p className="mt-2 text-[11px] text-muted-foreground">
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
      <p className="mt-2 text-[11px] text-muted-foreground">
        사업보고서 인력 주석·인건비 계정 연동은 후속.
      </p>
    </WidgetShell>
  );
}

function EventsBoundWidget({
  widgetId,
  data,
  eventTypeIncludes,
  /**
   * `events` 에 실리지 않는 주제를 공시 제목으로 집는다. 배당이 대표적이다 —
   * `event_type` 에는 배당이 아예 없고 `filings.report_nm` 에만 있다.
   */
  reportNameIncludes = [],
  emptyHint,
}: {
  widgetId: WidgetId;
  data: BoardData;
  eventTypeIncludes: string[];
  reportNameIncludes?: string[];
  emptyHint?: string;
}) {
  const meta = WIDGETS[widgetId];
  const facts = filterTrackingsByTopics(data.trackings, meta.trackingTopics);
  const events = data.events.filter((e) =>
    eventTypeIncludes.some((k) => e.event_type.includes(k)),
  );
  const filings =
    reportNameIncludes.length > 0
      ? filterFilingsByName(data.themedFilings, reportNameIncludes)
      : [];
  const empty = facts.length === 0 && events.length === 0 && filings.length === 0;
  const latestFact = facts[facts.length - 1];
  const latestEvent = events[0];
  const latestFiling = filings[0];
  const claim = latestFact
    ? latestFact.fact
    : latestEvent
      ? `${latestEvent.event_type} (${latestEvent.rcept_dt ?? '일자 미상'})`
      : latestFiling
        ? `${latestFiling.report_nm} (${latestFiling.rcept_dt})`
        : meta.claim;

  const evidence = empty
    ? undefined
    : [
        facts.length > 0 && `트래킹 ${facts.length}건`,
        events.length > 0 && `이벤트 ${events.length}건`,
        filings.length > 0 && `공시 ${filings.length}건`,
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <WidgetShell
      meta={meta}
      claim={claim}
      evidence={evidence}
      empty={empty}
      emptyHint={emptyHint}
    >
      {facts.length > 0 && <TrackingFactList facts={facts} limit={5} />}
      {events.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-sm">
          {events.slice(0, 5).map((e) => (
            <li key={e.id} className="flex justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{e.rcept_dt ?? '—'}</span>
              <span className="text-right">{e.event_type}</span>
            </li>
          ))}
        </ul>
      )}
      {filings.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-sm">
          {filings.slice(0, 5).map((f) => (
            <li key={f.rcept_no} className="flex justify-between gap-2 text-xs">
              <span className="shrink-0 text-muted-foreground">{f.rcept_dt}</span>
              <span className="text-right">{f.report_nm}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

/**
 * 대주주·지분 변동.
 *
 * 예전 구현은 `events.event_type` 에서 `대량보유`·`임원ㆍ주요주주` 를 찾았는데 그 값들은
 * `event_type` 에 존재하지 않아 **영원히 빈 위젯**이었다. 정본은 `ownership_txns` 이고,
 * 아직 파싱되지 않은 회사는 공시 목록(`report_nm`)으로라도 1차 자료를 보여준다.
 */
function MajorShareholderWidget({ data }: { data: BoardData }) {
  const meta = WIDGETS['major-shareholder'];
  const txns = data.ownershipTxns;
  const filings = filterFilingsByName(data.themedFilings, ['대량보유', '주요주주']);
  const empty = txns.length === 0 && filings.length === 0;

  /**
   * 헤드라인은 "가장 최근 행"이 아니라 **가장 크게 움직인 행**이다.
   * 지분 이동은 매도·매수가 같은 날 쌍으로 들어와서, 날짜만으로 고르면 전량 처분해
   * 0% 가 된 쪽이 잡혀 "0% 보유"라는 무의미한 요약이 나온다.
   */
  const headline = txns.reduce<{ txn: OwnershipTxn; o: ReturnType<typeof readOwnership> } | null>(
    (best, txn) => {
      const o = readOwnership(txn);
      const weight = Math.abs(o.sharesDelta ?? 0);
      if (!best) return { txn, o };
      return weight > Math.abs(best.o.sharesDelta ?? 0) ? { txn, o } : best;
    },
    null,
  );

  const claim = headline
    ? (() => {
        const { reporter, ratio, shares, sharesDelta } = headline.o;
        const who = reporter ?? '보고자 미상';
        const delta = sharesDelta
          ? ` (${sharesDelta > 0 ? '+' : ''}${sharesDelta.toLocaleString('ko-KR')}주)`
          : '';
        if (shares === 0) return `${who} 전량 처분${delta}`;
        return `${who} ${ratio != null ? `${ratio}%` : '비율 미상'} 보유${delta}`;
      })()
    : filings.length > 0
      ? `지분 공시 ${filings.length}건 — 상세 파싱은 미적재`
      : meta.claim;

  return (
    <WidgetShell
      meta={meta}
      claim={claim}
      evidence={
        empty
          ? undefined
          : txns.length > 0
            ? `ownership_txns ${txns.length}건`
            : `공시 목록 ${filings.length}건 (원장 미적재)`
      }
      empty={empty}
      emptyHint="지분 변동 원장·공시 모두 없음"
    >
      {txns.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {txns.slice(0, 6).map((t) => {
            const o = readOwnership(t);
            return (
              <li key={t.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0">
                  <span className="text-xs text-muted-foreground">{t.rcept_dt ?? '—'}</span>{' '}
                  <span className="font-medium">{o.reporter ?? '—'}</span>
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    {OWNERSHIP_KIND_LABELS[t.kind]}
                  </span>
                  {o.note && (
                    <span className="block truncate text-xs text-muted-foreground">{o.note}</span>
                  )}
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {o.ratio != null ? `${o.ratio}%` : '—'}
                  {o.sharesDelta ? (
                    <span
                      className={`ml-1.5 text-xs ${o.sharesDelta > 0 ? 'text-positive' : 'text-negative'}`}
                    >
                      {o.sharesDelta > 0 ? '+' : ''}
                      {o.sharesDelta.toLocaleString('ko-KR')}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <ul className="space-y-1.5 text-sm">
            {filings.slice(0, 6).map((f) => (
              <li key={f.rcept_no} className="flex justify-between gap-2 text-xs">
                <span className="shrink-0 text-muted-foreground">{f.rcept_dt}</span>
                <span className="text-right">{f.report_nm}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            공시는 있으나 지분 원장(ownership_txns)이 이 종목엔 아직 적재되지 않았습니다 —
            보유 비율·증감은 원문에서 확인하세요.
          </p>
        </>
      )}
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
      return <MajorShareholderWidget key={widgetId} data={data} />;
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
          // 자기주식은 event_type 에 있지만 배당은 없다 — 배당은 report_nm 으로만 잡힌다.
          eventTypeIncludes={['자기주식', '자사주']}
          reportNameIncludes={['배당']}
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
    <StaggerReveal className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {widgetIds.map((id) => renderBoardWidget(id, data))}
    </StaggerReveal>
  );
}
