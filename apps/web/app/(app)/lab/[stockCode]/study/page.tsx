import { permanentRedirect } from 'next/navigation';
import { LEGACY_BOARD_SLUGS } from '@/lib/analysis';

/**
 * 옛 IA 의 슬러그. 2026-08 개편에서 8단계 논증 구조로 바뀌며 사라졌지만,
 * 북마크·외부 링크가 죽지 않도록 새 화면으로 301 한다. 매핑은 catalog 가 정본.
 */
export default async function LegacyBoardRedirect(
  props: PageProps<'/lab/[stockCode]/study'>,
) {
  const { stockCode } = await props.params;
  permanentRedirect(`/lab/${stockCode}/${LEGACY_BOARD_SLUGS['study']}`);
}
