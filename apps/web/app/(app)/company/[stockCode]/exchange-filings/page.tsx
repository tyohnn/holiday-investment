import type { Metadata } from 'next';
import { GuidePage } from '../_components/guide-page';

export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<'/company/[stockCode]/exchange-filings'>,
): Promise<Metadata> {
  const { stockCode } = await props.params;
  return { title: `거래소공시 · ${stockCode}` };
}

export default async function Page(props: PageProps<'/company/[stockCode]/exchange-filings'>) {
  const { stockCode } = await props.params;
  return <GuidePage stockCode={stockCode} menuId="exchange-filings" />;
}
