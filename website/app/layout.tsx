import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Noto_Sans_KR } from 'next/font/google';
import type { Metadata } from 'next';
import { appName } from '@/lib/shared';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description:
    '박순혁 투자 방법론과 이차전지 교재 — 우공이산 멤버십 강의 기반 위키',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className={notoSansKr.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
