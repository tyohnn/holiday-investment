import type { Metadata } from 'next';
import { GuidePage } from './_components/guide-page';

export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<'/company/[stockCode]'>,
): Promise<Metadata> {
  const { stockCode } = await props.params;
  return { title: `Snapshot · ${stockCode}` };
}

export default async function Page(props: PageProps<'/company/[stockCode]'>) {
  const { stockCode } = await props.params;
  return <GuidePage stockCode={stockCode} menuId="snapshot" />;
}
