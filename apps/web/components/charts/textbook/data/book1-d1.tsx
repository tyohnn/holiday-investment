import { ChartBarGrouped } from '../../bar-grouped';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-d1-hyundai-kia',
    title: '현대차 vs 기아 — 재무제표 세 항목',
    description: '매출 성장률·영업이익률·ROE 세 지표 모두 기아가 앞선다',
    source: '14장 본문 「현대차와 기아를 비교하면 이렇다」 표',
    render: () => (
      <ChartBarGrouped
        data={[
          { metric: '매출 성장률', hyundai: 13.7, kia: 15.3 },
          { metric: '영업이익률(4년 평균)', hyundai: 7.7, kia: 9.95 },
          { metric: 'ROE(평균)', hyundai: 10.9, kia: 17.6 },
        ]}
        config={{
          hyundai: { label: '현대차', color: 'var(--chart-1)' },
          kia: { label: '기아', color: 'var(--chart-2)' },
        }}
        xKey="metric"
        series={['hyundai', 'kia']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
