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
  description: '기업 가치평가와 이차전지 산업 분석을 다루는 2권 55장 투자 교재',
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
