'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BOARDS, SECTION_LABELS, type BoardSection } from '@/lib/analysis';

const SECTION_ORDER: BoardSection[] = ['company', 'industry', 'agent'];

export function AnalysisSidebar({ stockCode }: { stockCode: string }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6 text-sm" aria-label="분석 화면">
      {SECTION_ORDER.map((section) => {
        const boards = BOARDS.filter((b) => b.section === section);
        if (boards.length === 0) return null;
        return (
          <div key={section}>
            <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {SECTION_LABELS[section]}
            </h2>
            <ul className="space-y-0.5">
              {boards.map((board) => {
                const href = `/company/${stockCode}/${board.slug}`;
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={board.id}>
                    <Link
                      href={href}
                      className={`block rounded-lg px-2 py-1.5 leading-snug transition-colors ${
                        active
                          ? 'bg-accent font-medium text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      }`}
                    >
                      {board.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
