import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-i5-tariff-incidence',
    title: '배터리 사슬 품목별 관세율',
    description: '대신할 것이 없는 품목(양극재·음극재)은 면제, 대안이 있는 품목은 관세가 붙는다',
    source:
      '30장 본문 「관세를 매기는 쪽도 부담의 행선지를 계산한다」 표 — 미국의 배터리 사슬 관세 취급',
    render: () => (
      <ChartBarHorizontal
        data={[
          { item: '양극재', rate: 0 },
          { item: '음극재', rate: 0 },
          { item: '셀 완제품', rate: 15 },
          { item: '동박·알루미늄박', rate: 50 },
        ]}
        config={{ rate: { label: '미국 관세율', color: 'var(--chart-1)' } }}
        categoryKey="item"
        dataKey="rate"
        categoryWidth={100}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
