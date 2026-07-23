import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center flex-1 px-6 py-16 max-w-3xl mx-auto">
      <p className="text-sm text-fd-muted-foreground mb-3">우공이산 · 박순혁</p>
      <h1 className="text-3xl font-bold tracking-tight mb-4">우공이산 위키</h1>
      <p className="text-fd-muted-foreground leading-relaxed mb-8">
        멤버십 강의 155편을 바탕으로 정리한 정량적 주식 평가 방법론과 이차전지
        과학·기술·밸류체인 교재입니다. 모든 서술은 강의 출처를 인용합니다.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/docs"
          className="inline-flex items-center justify-center rounded-md bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground"
        >
          교재 시작하기
        </Link>
        <Link
          href="/docs/book1"
          className="inline-flex items-center justify-center rounded-md border px-4 py-2.5 text-sm font-medium"
        >
          교재① 방법론
        </Link>
        <Link
          href="/docs/book2"
          className="inline-flex items-center justify-center rounded-md border px-4 py-2.5 text-sm font-medium"
        >
          교재② 이차전지
        </Link>
      </div>
    </div>
  );
}
