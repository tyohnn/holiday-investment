import type { Metadata } from 'next';
import Link from 'next/link';
import { THEME_SECTIONS, sectionHref } from '@/lib/nav';

export const metadata: Metadata = {
  title: '부동산',
};

export default function RealEstateHomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">테마</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">부동산</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        주식과 같은 섹션 뼈대만 열어 두었습니다. 종목·매크로·뉴스·보드 데이터는 아직 없습니다.
      </p>
      <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
        {THEME_SECTIONS.map((section) => (
          <li key={section.id}>
            <Link
              href={sectionHref('real-estate', section.id)}
              className="flex flex-col px-4 py-3 hover:bg-accent/40"
            >
              <span className="font-medium">{section.label}</span>
              <span className="text-xs text-muted-foreground">{section.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
