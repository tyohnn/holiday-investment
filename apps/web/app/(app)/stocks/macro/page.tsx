import type { Metadata } from 'next';
import Link from 'next/link';
import { industryMapHref } from '@/lib/nav';

export const metadata: Metadata = {
  title: '거시경제 분석',
};

export default function MacroLandingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">주식</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">거시경제 분석</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        종목보다 한 층 위에서 산업과 국면을 봅니다. 금리·환율 피드는 아직 없고, 산업 지도부터
        열려 있습니다.
      </p>

      <ul className="mt-8 space-y-3">
        <li>
          <Link
            href={industryMapHref()}
            className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
          >
            <h2 className="font-semibold">산업 지도</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              KSIC 격자 위에 분석이 진행된 밸류체인을 겹칩니다.
            </p>
          </Link>
        </li>
        <li className="rounded-xl border border-dashed border-border p-5">
          <h2 className="font-semibold text-muted-foreground">금리 · 환율 · 경기</h2>
          <p className="mt-1 text-sm text-muted-foreground">매크로 시계열 슬롯 — 아직 비어 있습니다.</p>
        </li>
      </ul>
    </div>
  );
}
