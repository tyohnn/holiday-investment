import { notFound } from 'next/navigation';
import {
  formatPercent,
  formatWon,
  readOwnership,
  type AnnualSummary,
  type OwnershipTxn,
} from '@investment/schema';
import { getCompanyMenu, type CompanyMenuId } from '@/lib/company';
import { getCompanyPageData } from '@/lib/platform/db';
import { CorrectionChains } from '../../../lab/[stockCode]/_components/correction-chains';
import { EventsSection } from '../../../lab/[stockCode]/_components/events-section';
import { FilingTimeline } from '../../../lab/[stockCode]/_components/filing-timeline';
import { FinancialChart } from '../../../lab/[stockCode]/_components/financial-chart';
import { KeyMetrics } from '../../../lab/[stockCode]/_components/key-metrics';

export async function GuidePage({
  stockCode,
  menuId,
}: {
  stockCode: string;
  menuId: CompanyMenuId;
}) {
  const menu = getCompanyMenu(menuId);
  const data = await getCompanyPageData(stockCode);
  if (!data) notFound();

  const { annual, filings, corrections, events, ownershipTxns } = data;
  const latestYear = annual.length > 0 ? annual[annual.length - 1] : null;
  const previousYear = annual.length > 1 ? annual[annual.length - 2] : null;

  return (
    <div className="space-y-6 pb-12">
      {menuId === 'snapshot' && (
        <>
          {latestYear && <KeyMetrics latest={latestYear} previous={previousYear} />}
          {annual.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">재무 추이</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {annual[0].bsns_year}~{annual[annual.length - 1].bsns_year}
              </p>
              <div className="mt-3 rounded-xl border border-border bg-card p-4">
                <FinancialChart data={annual} />
              </div>
            </section>
          )}
        </>
      )}

      {menuId === 'financials' && (
        <>
          {annual.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <FinancialChart data={annual} />
            </div>
          )}
          <AnnualTable
            annual={annual}
            columns={[
              { key: 'revenue', label: '매출액' },
              { key: 'operating_income', label: '영업이익' },
              { key: 'net_income', label: '당기순이익' },
              { key: 'assets', label: '자산' },
              { key: 'liabilities', label: '부채' },
              { key: 'equity', label: '자본' },
              { key: 'cf_operating', label: '영업CF' },
            ]}
          />
        </>
      )}

      {menuId === 'ratios' && (
        <>
          {latestYear && <KeyMetrics latest={latestYear} previous={previousYear} />}
          <AnnualTable
            annual={annual}
            percent
            columns={[
              { key: 'opm_pct', label: '영업이익률' },
              { key: 'roe_pct', label: 'ROE' },
              { key: 'debt_ratio_pct', label: '부채비율' },
            ]}
          />
        </>
      )}

      {menuId === 'ownership' && <OwnershipTable rows={ownershipTxns} />}

      {menuId === 'exchange-filings' && (
        <>
          <EventsSection events={events} />
          {events.length === 0 && <EmptyState title={menu.title} reason="이 회사는 해당 공시 없음" />}
        </>
      )}

      {menuId === 'fss-filings' && (
        <>
          <FilingTimeline filings={filings} />
          <CorrectionChains corrections={corrections} />
          {filings.length === 0 && corrections.length === 0 && (
            <EmptyState title={menu.title} reason="이 회사는 해당 공시 없음" />
          )}
        </>
      )}

      {(menuId === 'indicators' ||
        menuId === 'consensus' ||
        menuId === 'sector' ||
        menuId === 'peers') && (
        <EmptyState title={menu.title} reason="아직 적재 전" />
      )}
    </div>
  );
}

function EmptyState({ title, reason }: { title: string; reason: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
      {title} — {reason}
    </p>
  );
}

type AmountKey =
  | 'revenue'
  | 'operating_income'
  | 'net_income'
  | 'assets'
  | 'liabilities'
  | 'equity'
  | 'cf_operating'
  | 'opm_pct'
  | 'roe_pct'
  | 'debt_ratio_pct';

function AnnualTable({
  annual,
  columns,
  percent = false,
}: {
  annual: AnnualSummary[];
  columns: { key: AmountKey; label: string }[];
  percent?: boolean;
}) {
  if (annual.length === 0) {
    return <EmptyState title="연간 수치" reason="데이터 없음" />;
  }

  const years = [...annual].reverse();

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">계정</th>
            {years.map((row) => (
              <th key={row.bsns_year} className="px-3 py-2 text-right font-medium">
                {row.bsns_year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {columns.map((column) => (
            <tr key={column.key}>
              <td className="px-3 py-2">{column.label}</td>
              {years.map((row) => (
                <td key={`${column.key}-${row.bsns_year}`} className="px-3 py-2 text-right tabular-nums">
                  {percent
                    ? formatPercent(row[column.key])
                    : formatWon(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OwnershipTable({ rows }: { rows: OwnershipTxn[] }) {
  if (rows.length === 0) {
    return <EmptyState title="지분분석" reason="데이터 없음" />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">접수일</th>
            <th className="px-3 py-2 text-left font-medium">구분</th>
            <th className="px-3 py-2 text-left font-medium">보고자</th>
            <th className="px-3 py-2 text-right font-medium">보유 비율</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const read = readOwnership(row);
            return (
              <tr key={row.id}>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.rcept_dt ?? '—'}</td>
                <td className="px-3 py-2">{row.kind}</td>
                <td className="px-3 py-2">{read.reporter ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPercent(read.ratio)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
