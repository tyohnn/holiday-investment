import { ChartBarBasic } from '../../bar-basic';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-c1-ev-growth',
    title: '전기차 판매 성장률 — 109%에서 16.5%로',
    description:
      '2021년 109.1% 급성장 이후 4년 연속 성장률이 둔화돼 2024년 16.5%까지 떨어졌다 — 이것이 캐즘이다',
    source: '9장 본문 「개발 주기 5년 — 캐즘이 발생한 메커니즘」 절 표',
    render: () => (
      <ChartBarBasic
        data={[
          { year: '2020', growth: 38.5 },
          { year: '2021', growth: 109.1 },
          { year: '2022', growth: 56.9 },
          { year: '2023', growth: 33.5 },
          { year: '2024', growth: 16.5 },
        ]}
        config={{ growth: { label: '전기차 판매 성장률', color: 'var(--chart-1)' } }}
        xKey="year"
        dataKey="growth"
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
