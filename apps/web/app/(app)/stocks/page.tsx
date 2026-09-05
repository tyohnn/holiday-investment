import type { Metadata } from 'next';
import { HomeLanding } from '../_components/home-landing';

export const metadata: Metadata = {
  title: '주식',
};

export default function StocksHomePage() {
  return <HomeLanding />;
}
