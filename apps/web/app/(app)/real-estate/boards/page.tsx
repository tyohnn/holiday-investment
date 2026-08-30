import type { Metadata } from 'next';
import { ThemeSectionPlaceholder } from '@/components/theme-section-placeholder';

export const metadata: Metadata = { title: '리서치 보드 · 부동산' };

export default function Page() {
  return <ThemeSectionPlaceholder theme="real-estate" section="boards" />;
}
