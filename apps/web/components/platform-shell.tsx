import Link from 'next/link';
import { appName } from '@/lib/shared';

/**
 * 플랫폼(교재 뷰어가 아닌 쪽) 공통 껍데기.
 *
 * /company 와 /industry 가 같은 헤더를 쓴다 — 산업이 종목의 하위가 아니라 나란한 축이기
 * 때문이다(종목 하위의 "밸류체인/부품" 화면은 반대 방향, 즉 "이 종목이 체인 어디에 있나"다).
 */
export function PlatformShell({
  children,
  maxWidth = 'max-w-7xl',
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/company" className="text-sm font-semibold tracking-tight">
            {appName} · 리서치
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/industry" className="hover:text-foreground">
              산업 지도
            </Link>
            <Link href="/company" className="hover:text-foreground">
              종목 목록
            </Link>
            <Link href="/book" className="hover:text-foreground">
              교재
            </Link>
          </nav>
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 ${maxWidth}`}>{children}</main>
    </div>
  );
}
