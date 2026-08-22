import type { Metadata } from 'next';
import { GuidePage } from '../_components/guide-page';

export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<'/company/[stockCode]/indicators'>,
): Promise<Metadata> {
  const { stockCode } = await props.params;
  return { title: `투자지표 · ${stockCode}` };
}

export default async function Page(props: PageProps<'/company/[stockCode]/indicators'>) {
  const { stockCode } = await props.params;
  return <GuidePage stockCode={stockCode} menuId="indicators" />;
}
