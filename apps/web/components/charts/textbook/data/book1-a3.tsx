import { ChartBarDualAxis } from '../../bar-dual-axis';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-a3-target-price-decay',
    title: '목표주가는 EPS와 배수를 동시에 깎아 무너진다',
    description:
      '넉 달 사이 EPS 추정치와 PER 배수가 함께 내려가며 목표주가가 30만 원대에서 17만 원대로 바뀐 사례',
    source:
      '3장 본문 「실제로 이런 일이 있었다」 문단 — EPS 5,348원→3,820원, 배수 56배→44배, 목표주가 30만 원대→17만 원대',
    render: () => (
      <ChartBarDualAxis
        data={[
          { stage: '4개월 전', eps: 5348, per: 56 },
          { stage: '지금', eps: 3820, per: 44 },
        ]}
        config={{
          eps: { label: 'EPS(원)', color: 'var(--chart-1)' },
          per: { label: 'PER(배)', color: 'var(--chart-2)' },
        }}
        xKey="stage"
        barKey="eps"
        lineKey="per"
        barValueFormatter={(n) => `${n.toLocaleString()}원`}
        lineValueFormatter={(n) => `${n}배`}
      />
    ),
  },
]);
