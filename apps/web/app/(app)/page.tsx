import type { Metadata } from 'next';
import { HomeLanding } from './_components/home-landing';

export const metadata: Metadata = {
  title: '종목 검색',
};

export default function HomePage() {
  return <HomeLanding />;
}
