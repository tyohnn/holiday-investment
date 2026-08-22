import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFilingByRceptNo, getFilingSectionContent } from '@/lib/platform/db';
import { FilingSectionMarkdown } from '../../../_components/filing-section-md';
import { dartUrl, formatKoDate } from '../../../_components/format';

export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<'/lab/[stockCode]/filing/[rceptNo]/[secNo]'>,
): Promise<Metadata> {
  const { rceptNo, secNo } = await props.params;
  const section = await getFilingSectionContent(rceptNo, Number(secNo));
  return { title: section ? `${section.title} · 공시 원문` : '공시 원문' };
}

export default async function FilingSectionPage(
  props: PageProps<'/lab/[stockCode]/filing/[rceptNo]/[secNo]'>,
) {
  const { stockCode, rceptNo, secNo } = await props.params;
  const [section, filing] = await Promise.all([
    getFilingSectionContent(rceptNo, Number(secNo)),
    getFilingByRceptNo(rceptNo),
  ]);
  if (!section || !section.content) notFound();

  return (
    <div className="space-y-4 pb-16">
      <Link
        href={`/lab/${stockCode}/financials`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {stockCode} 재무 전체보기로
      </Link>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {section.is_note && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
              ★ 주석
            </span>
          )}
          {section.is_biz && (
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-semibold text-sky-600 dark:text-sky-400">
              ☆ 사업의 내용
            </span>
          )}
          {filing && <span>{filing.report_nm}</span>}
          {filing && <span>· 접수 {formatKoDate(filing.rcept_dt)}</span>}
        </div>
        <h1 className="mt-2 text-xl font-bold tracking-tight">{section.title}</h1>
        <a
          href={dartUrl(rceptNo)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-xs text-muted-foreground hover:text-primary hover:underline"
        >
          DART 원문 열기 →
        </a>
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          자동 변환 결과이며 표 서식이 원문과 다를 수 있다. 수치를 인용하기 전에 위 원문 링크와
          대조한다.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <FilingSectionMarkdown content={section.content} />
      </div>
    </div>
  );
}
