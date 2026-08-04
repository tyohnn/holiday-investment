import { ChartBarBasic } from '../../bar-basic';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-e2-diversification',
    title: '종목 수와 계좌 흔들림',
    description: '종목 수를 늘릴수록 전체 흔들림(변동성)이 줄어드는 정도',
    source: '17장 본문 「5~10개가 분산 효과와 집중의 균형점이다」 표',
    render: () => (
      <ChartBarBasic
        data={[
          { count: '1종목', volatility: 41.7 },
          { count: '5종목', volatility: 27.4 },
          { count: '10종목', volatility: 24.4 },
          { count: '20종목', volatility: 22.6 },
        ]}
        config={{
          volatility: { label: '전체 흔들림', color: 'var(--chart-1)' },
        }}
        xKey="count"
        dataKey="volatility"
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
