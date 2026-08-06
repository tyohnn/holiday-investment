import Link from 'next/link';
import type { Metadata } from 'next';
import { listCompanies } from '@/lib/platform/db';

export const metadata: Metadata = {
  title: '종목 목록',
};

export const revalidate = 0;

export default async function CompanyListPage() {
  const companies = await listCompanies();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">종목 목록</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        DART 공시·사실 시계열이 적재된 종목입니다. 카드를 누르면 매출 변화 분석 화면으로
        이동합니다.
      </p>

      {companies.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          데이터 없음
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {companies.map((c) => (
            <Link
              key={c.corp_code}
              href={`/company/${c.stock_code}`}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/60 hover:bg-accent/40"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold group-hover:text-primary">{c.name}</h2>
                {c.market && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    {c.market}
                  </span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <dt>종목코드</dt>
                  <dd className="font-mono text-foreground">{c.stock_code}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>대표이사</dt>
                  <dd className="text-foreground">{c.ceo ?? '—'}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
