import type { Metadata } from 'next';
import { GuidePage } from '../_components/guide-page';

export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<'/company/[stockCode]/ratios'>,
): Promise<Metadata> {
  const { stockCode } = await props.params;
  return { title: `재무비율 · ${stockCode}` };
}

export default async function Page(props: PageProps<'/company/[stockCode]/ratios'>) {
  const { stockCode } = await props.params;
  return <GuidePage stockCode={stockCode} menuId="ratios" />;
}
