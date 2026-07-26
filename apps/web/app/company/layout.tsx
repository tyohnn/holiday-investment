import Link from 'next/link';
import { appName } from '@/lib/shared';

export default function CompanyLayout({ children }: LayoutProps<'/company'>) {
  return (
    <div className="flex flex-col min-h-screen bg-fd-background text-fd-foreground">
      <header className="sticky top-0 z-10 border-b border-fd-border bg-fd-background/95 backdrop-blur supports-backdrop-filter:bg-fd-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/company" className="text-sm font-semibold tracking-tight">
            {appName} · 종목 리서치
          </Link>
          <nav className="flex items-center gap-4 text-sm text-fd-muted-foreground">
            <Link href="/company" className="hover:text-fd-foreground">
              종목 목록
            </Link>
            <Link href="/docs" className="hover:text-fd-foreground">
              교재
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
