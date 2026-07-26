import { redirect } from 'next/navigation';

export default async function StockIndexPage(props: PageProps<'/company/[stockCode]'>) {
  const { stockCode } = await props.params;
  redirect(`/company/${stockCode}/revenue`);
}
