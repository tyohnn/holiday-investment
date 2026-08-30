import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '전체 뉴스',
};

export default function StocksNewsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">주식</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">전체 뉴스</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        테마 전체 헤드라인을 한곳에서 보는 화면입니다. 피드 연동 전이라 칸만 열어 두었습니다.
      </p>
      <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        뉴스 슬롯 — 준비 중
      </div>
    </div>
  );
}
