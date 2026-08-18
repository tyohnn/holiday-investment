import type { Metadata } from 'next';
import Link from 'next/link';
import { getCompany } from '@/lib/platform/db';
import { getProductStory, stubCompanyForStory } from '@/lib/product-story';
import { notFound } from 'next/navigation';
import { ProductStoryCanvas } from './_components/product-story-canvas';

export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<'/lab/[stockCode]/products'>,
): Promise<Metadata> {
  const { stockCode } = await props.params;
  const company = await getCompany(stockCode);
  return { title: `제품 지도 · ${company?.name ?? stockCode}` };
}

export default async function ProductStoryPage(
  props: PageProps<'/lab/[stockCode]/products'>,
) {
  const { stockCode } = await props.params;
  const story = getProductStory(stockCode);
  const company = (await getCompany(stockCode)) ?? (story ? stubCompanyForStory(story) : null);
  if (!company) notFound();

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      {story ? (
        <ProductStoryCanvas story={story} />
      ) : (
        <div className="mx-auto max-w-lg px-6 py-16">
          <h1 className="text-xl font-bold">제품 지도가 아직 없다</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {company.name}({stockCode})은 라인·SKU 스토리를 아직 수집하지 않았다.
            에이피알(278470)처럼 부문 실적과 히트 SKU가 모이면 같은 장면 구조로 올린다.
          </p>
          <Link
            href={`/lab/${stockCode}/circle`}
            className="mt-6 inline-block text-sm text-primary underline-offset-2 hover:underline"
          >
            능력범위로 돌아가기
          </Link>
        </div>
      )}
    </div>
  );
}
