import './global.css';
import { Geist_Mono, Noto_Sans, Noto_Sans_KR } from 'next/font/google';
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { appName } from '@/lib/shared';
import { isBookHidden } from '@/lib/hidden-books';
import { cn } from '@/lib/cn';

/*
 * shadcn/typeset's font pair, plus Noto Sans KR for Hangul — Noto Sans has no
 * Hangul coverage, so the two are stacked in `--font-app-sans` (global.css).
 */
const notoSans = Noto_Sans({
  subsets: ['latin'],
  variable: '--font-noto-sans',
});

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-kr',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: isBookHidden('book2')
    ? '기업 가치평가를 다루는 투자 교재'
    : '기업 가치평가와 이차전지 산업 분석을 다루는 2권 55장 챕터 교재',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="ko"
      className={cn(notoSans.variable, notoSansKr.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
