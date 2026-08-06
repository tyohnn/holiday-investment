import type { Metadata } from 'next';
import Link from 'next/link';
import { ksicDivision } from '@investment/schema';
import {
  INDUSTRIES,
  SIEVE_LABELS,
  VERDICT_ORDER,
  industryStockCodes,
  verdictCounts,
  type Industry,
} from '@/lib/industry';
import { getCompaniesByStockCodes, getListedDivisionCounts } from '@/lib/platform/db';
import { SectorGrid, type DivisionCoverage } from './_components/sector-grid';
import { VERDICT_CLASS } from './_components/verdict';

export const metadata: Metadata = {
  title: '산업 지도',
  description: 'KSIC 중분류로 덮은 전 상장사 위에, 분석이 진행된 산업을 겹쳐 놓은 지도',
};

// 빌드 환경에는 DB 자격증명이 없으므로 프리렌더가 불가능하다 — revalidate 를 두면
// 이 화면이 빌드 타임에 생성 대상이 되고, db.ts 의 폴백인 로컬 127.0.0.1:54321 로
// 붙으러 가서 빌드가 깨진다(PR #38 최초 실패). 캐시는 데이터 계층에서 건다.
export const revalidate = 0;

export default async function IndustryMapPage() {
  const [{ divisions, totalListed }, industryMembers] = await Promise.all([
    getListedDivisionCounts(),
    Promise.all(
      INDUSTRIES.map(async (industry) => ({
        industry,
        companies: await getCompaniesByStockCodes(industryStockCodes(industry)),
      })),
    ),
  ]);

  // 격자 하이라이트는 카탈로그의 `ksicPrefixes` 가 아니라 **실제 소속사의 업종코드**로
  // 계산한다. 접두는 재현율을 위해 넓게 던진 그물이라 그대로 칠하면 무관한 회사 수백 개가
  // 그 산업으로 보인다(20 화학만 171개사다).
  const coverage = new Map<string, DivisionCoverage>();
  let coveredCompanies = 0;
  for (const { industry, companies } of industryMembers) {
    coveredCompanies += companies.length;
    const perDivision = new Map<string, number>();
    for (const c of companies) {
      const d = ksicDivision(c.sector_code);
      if (!d) continue;
      perDivision.set(d, (perDivision.get(d) ?? 0) + 1);
    }
    for (const [division, members] of perDivision) {
      const entry = coverage.get(division) ?? { industries: [] };
      entry.industries.push({ slug: industry.slug, name: industry.name, members });
      coverage.set(division, entry);
    }
  }

  return (
    <div className="pb-16">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">산업 지도</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-fd-muted-foreground">
          무엇을 분석할지 고르는 화면이다. 아래 격자는 KSIC 중분류로 접은 전 상장사{' '}
          {totalListed.toLocaleString()}개사이고, 그 위에 밸류체인까지 정의된 산업을 겹쳐
          놓았다. 색이 없는 칸이 아직 들여다보지 않은 땅이다.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">분석된 산업</h2>
        <p className="mt-1 text-sm text-fd-muted-foreground">
          경계와 밸류체인 단계를 손으로 확정한 산업. 소속 {coveredCompanies}개사 / 상장{' '}
          {totalListed.toLocaleString()}개사.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {industryMembers.map(({ industry, companies }) => (
            <IndustryCard key={industry.slug} industry={industry} listed={companies.length} />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">KSIC 중분류 격자</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-fd-muted-foreground">
          한 칸이 하나의 밸류체인이라는 뜻은 아니다 — 행정 분류이기 때문이다. 이차전지
          28개사만 해도 일곱 칸에 흩어져 있고, 반대로 한 칸에는 그 산업과 무관한 회사가 훨씬
          많다. 칸의 배지는 &ldquo;이 칸 = 그 산업&rdquo;이 아니라 &ldquo;이 칸에 그 산업 종목이 몇 개
          있다&rdquo;로 읽는다.
        </p>
        <div className="mt-6">
          <SectorGrid divisions={divisions} coverage={coverage} />
        </div>
      </section>
    </div>
  );
}

function IndustryCard({ industry, listed }: { industry: Industry; listed: number }) {
  const counts = verdictCounts(industry);
  const judged = VERDICT_ORDER.reduce((s, v) => s + counts[v], 0);
  const touched = new Set(
    industry.ksicPrefixes.map((p) => p.slice(0, 2)).filter((p) => p.length === 2),
  );

  return (
    <Link
      href={`/industry/${encodeURIComponent(industry.slug)}`}
      className="group flex flex-col rounded-xl border border-fd-border bg-fd-card p-5 transition-colors hover:border-fd-primary/60 hover:bg-fd-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold group-hover:text-fd-primary">{industry.name}</h3>
          <p className="mt-0.5 text-sm text-fd-muted-foreground">{industry.tagline}</p>
        </div>
        <span className="shrink-0 rounded-md bg-fd-secondary px-2 py-0.5 text-xs font-medium text-fd-secondary-foreground">
          채 {industry.sieveStage}단계
        </span>
      </div>

      <p className="mt-3 text-xs text-fd-muted-foreground">
        {SIEVE_LABELS[industry.sieveStage]}까지 진행 · 기준일 {industry.asOf}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-fd-muted-foreground">판정 / 상장</dt>
          <dd className="font-medium tabular-nums">
            {judged}건 / {listed}개사
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fd-muted-foreground">체인 단계</dt>
          <dd className="font-medium tabular-nums">{industry.stages.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-fd-muted-foreground">후보 풀 접두</dt>
          <dd className="font-mono text-xs">{[...touched].join(' · ')}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {VERDICT_ORDER.filter((v) => counts[v] > 0).map((v) => (
          <span
            key={v}
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${VERDICT_CLASS[v]}`}
          >
            {v} {counts[v]}
          </span>
        ))}
      </div>

      <p className="mt-4 line-clamp-3 text-xs leading-relaxed text-fd-muted-foreground">
        {industry.summary}
      </p>
    </Link>
  );
}
