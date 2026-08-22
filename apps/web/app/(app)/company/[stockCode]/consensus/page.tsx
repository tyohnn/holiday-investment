import type { Metadata } from 'next';
import { GuidePage } from '../_components/guide-page';

export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<'/company/[stockCode]/consensus'>,
): Promise<Metadata> {
  const { stockCode } = await props.params;
  return { title: `컨센서스 · ${stockCode}` };
}

export default async function Page(props: PageProps<'/company/[stockCode]/consensus'>) {
  const { stockCode } = await props.params;
  return <GuidePage stockCode={stockCode} menuId="consensus" />;
}
