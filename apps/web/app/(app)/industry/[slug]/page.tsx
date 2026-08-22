import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ksicDivision, ksicDivisionName } from '@investment/schema';
import { isHiddenBookHref } from '@/lib/hidden-books';
import {
  SIEVE_LABELS,
  VERDICT_ORDER,
  getIndustry,
  industryStockCodes,
  unlistedJudged,
  verdictCounts,
} from '@/lib/industry';
import { getAnnualByCorpCodes, getCompaniesByStockCodes } from '@/lib/platform/db';
import { ValueChain, type MemberFacts } from '../_components/value-chain';
import { VERDICT_CLASS } from '../_components/verdict';

// 다른 DB 화면들과 같이 요청 시점 렌더다. 업종 구성은 상장·폐지로만 바뀌니 캐시해도
// 될 것 같지만, **빌드 환경에는 DB 자격증명이 없다** — 프리렌더를 시도하면 db.ts 의
// 폴백인 로컬 127.0.0.1:54321 로 붙으러 가서 빌드가 통째로 깨진다(PR #38 최초 실패).
// generateStaticParams 도 같은 이유로 두지 않는다. 캐시가 필요해지면 빌드 타임이 아니라
// 데이터 계층(unstable_cache)에서 건다.
export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<'/industry/[slug]'>,
): Promise<Metadata> {
  const { slug } = await props.params;
  const industry = getIndustry(decodeURIComponent(slug));
  if (!industry) return { title: '산업' };
  return { title: `${industry.name} 밸류체인`, description: industry.tagline };
}

/** 화면에 세우는 기준 연도. 카탈로그 기준일의 직전 회계연도다. */
const FACT_YEARS = [2023, 2024, 2025];
const DISPLAY_YEAR = 2025;

export default async function IndustryDetailPage(props: PageProps<'/industry/[slug]'>) {
  const { slug } = await props.params;
  const industry = getIndustry(decodeURIComponent(slug));
  if (!industry) notFound();

  const companies = await getCompaniesByStockCodes(industryStockCodes(industry));
  const annual = await getAnnualByCorpCodes(
    companies.map((c) => c.corp_code),
    FACT_YEARS,
  );

  const facts: MemberFacts = new Map();
  for (const c of companies) {
    if (!c.stock_code) continue;
    const rows = annual.get(c.corp_code) ?? [];
    facts.set(c.stock_code, { fsDiv: rows[0]?.fs_div ?? null, rows });
  }

  const counts = verdictCounts(industry);
  const judged = VERDICT_ORDER.reduce((s, v) => s + counts[v], 0);
  const unlisted = unlistedJudged(industry);

  // 격자에서와 같은 규칙: 실제 소속사의 업종코드로 흩어짐을 센다.
  const divisions = new Map<string, number>();
  for (const c of companies) {
    const d = ksicDivision(c.sector_code);
    if (d) divisions.set(d, (divisions.get(d) ?? 0) + 1);
  }
  const missing = industryStockCodes(industry).filter(
    (code) => !companies.some((c) => c.stock_code === code),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-16 sm:px-6 lg:px-8">
      <nav className="text-xs text-muted-foreground">
        <Link href="/industry" className="hover:text-foreground">
          산업 지도
        </Link>
        <span className="mx-1.5">/</span>
        <span>{industry.name}</span>
      </nav>

      <header className="mt-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{industry.name}</h1>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            채 {industry.sieveStage}단계 · {SIEVE_LABELS[industry.sieveStage]}
          </span>
          <span className="text-xs text-muted-foreground">기준일 {industry.asOf}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{industry.tagline}</p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">{industry.summary}</p>
      </header>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {VERDICT_ORDER.filter((v) => counts[v] > 0).map((v) => (
          <span
            key={v}
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${VERDICT_CLASS[v]}`}
          >
            {v} {counts[v]}
          </span>
        ))}
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          판정 합계 {judged}건
        </span>
      </div>
      {unlisted.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          판정 {judged}건 = 상장 종목 {companies.length}개사 + 종목 페이지가 없는{' '}
          {unlisted.length}건({unlisted.map((m) => m.name).join(', ')}). 우선주는 DART 법인이
          아니라 종목 페이지를 갖지 못한다.
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">밸류체인 지도</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          매출·이익률은 카탈로그가 아니라 <code className="text-xs">fin_periods</code> 에서 읽은{' '}
          {DISPLAY_YEAR}년 연간 값이다(연결 우선, 연결이 없는 회사만 별도로 표시된다). 판정과
          체인 위치는 {industry.asOf} 실행의 손 확정값이다.
        </p>
        <div className="mt-5">
          <ValueChain stages={industry.stages} facts={facts} year={DISPLAY_YEAR} />
        </div>
      </section>

      {industry.phase && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">산업 국면 3문</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {industry.phase.map((p) => (
              <article
                key={p.question}
                className="rounded-xl border border-border bg-card p-4"
              >
                <h3 className="text-sm font-semibold leading-snug">{p.question}</h3>
                <p className="mt-2 text-sm font-medium text-primary">{p.verdict}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.detail}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">KSIC 로는 한 덩어리가 아니다</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            소속 {companies.length}개사가 중분류 {divisions.size}개에 흩어져 있다. 산업의 경계를
            업종코드로 잡을 수 없다는 것이 이 표다.
          </p>
          <ul className="mt-3 space-y-1.5">
            {[...divisions.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([division, n]) => (
                <li key={division} className="flex items-baseline gap-2 text-xs">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {division}
                  </span>
                  <span className="flex-1">{ksicDivisionName(division)}</span>
                  <span className="tabular-nums text-muted-foreground">{n}</span>
                </li>
              ))}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
            채 0단계에서 후보를 긁을 때 쓴 접두:{' '}
            <span className="font-mono">{industry.ksicPrefixes.join(' · ')}</span> — 재현율을 위해
            넓게 던진 그물이라 무관한 회사가 대량으로 걸린다.
          </p>
          {missing.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
              DB 에서 찾지 못한 종목코드: {missing.join(', ')}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">출처</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            판정의 근거 문서. 이 저장소의 <code>리서치/</code> 는 웹에 게시되지 않으므로 경로로만
            적는다.
          </p>
          <ul className="mt-3 space-y-2">
            {industry.sources.map((s) => (
              <li key={s.path} className="text-xs">
                <span className="font-medium">{s.label}</span>
                <br />
                <code className="text-[10px] text-muted-foreground">{s.path}</code>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-sm font-semibold">방법론</h3>
          <ul className="mt-2 space-y-1">
            {industry.textbooks.map((t) => {
              const linkable = t.href && !isHiddenBookHref(t.href);
              return (
                <li key={t.label} className="text-xs">
                  {linkable ? (
                    <Link
                      href={t.href!}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {t.label}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">
                      {t.label}
                      {t.note ? ` (${t.note})` : ''}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <p className="mt-10 text-[11px] leading-relaxed text-muted-foreground">
        교재 방법론에 따른 학습·분석 자료이며 종목 추천이나 투자 권유가 아니다.
      </p>
    </div>
  );
}
