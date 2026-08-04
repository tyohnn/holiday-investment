import Link from 'next/link';
import { isBookHidden } from '@/lib/hidden-books';

export default function HomePage() {
  const book2Hidden = isBookHidden('book2');

  return (
    <div className="flex flex-col justify-center flex-1 px-6 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-4">숫자로 읽는 주식투자</h1>
      <p className="text-fd-muted-foreground leading-relaxed mb-8">
        {book2Hidden
          ? '기업의 가치를 계산하는 법을 정리했습니다. 모든 서술은 강의 출처를 인용합니다.'
          : '기업의 가치를 계산하는 법과 이차전지 산업을 해부하는 법을 두 권에 정리했습니다. 모든 서술은 강의 출처를 인용합니다.'}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/docs"
          className="inline-flex items-center justify-center rounded-md bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground"
        >
          교재 시작하기
        </Link>
        <Link
          href="/company"
          className="inline-flex items-center justify-center rounded-md border px-4 py-2.5 text-sm font-medium"
        >
          종목 분석
        </Link>
        <Link
          href="/docs/book1"
          className="inline-flex items-center justify-center rounded-md border px-4 py-2.5 text-sm font-medium"
        >
          1권 기업의 가치를 계산하는 법
        </Link>
        {!book2Hidden && (
          <Link
            href="/docs/book2"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2.5 text-sm font-medium"
          >
            2권 이차전지 산업을 해부하는 법
          </Link>
        )}
      </div>
    </div>
  );
}
