import { redirect } from 'next/navigation';
import { boardHref } from '@/lib/analysis';

/** 종목 진입점은 논증의 1단계(판정)로 보낸다 — 답이 랜딩이어야 한다. */
export default async function StockIndexPage(props: PageProps<'/company/[stockCode]'>) {
  const { stockCode } = await props.params;
  redirect(boardHref(stockCode));
}
