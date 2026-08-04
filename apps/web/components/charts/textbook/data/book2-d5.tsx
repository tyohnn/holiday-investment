import { ChartBarRange } from '../../extras/bar-range';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-d5-patent-overlap',
    title: '분야별 중국 업체의 한국 특허 침해율 추정',
    description:
      '원문의 "70퍼센트 이상", "80퍼센트 이상"은 상한이 명시돼 있지 않아 100%를 상한으로 표기했다(퍼센트의 이론적 상한).',
    source: '17장(D5) 본문 「첫 번째 겹 — 회피가 불가능한 특허망」 절, 침해율 추정 표',
    render: () => (
      <ChartBarRange
        data={[
          { field: '셀 구조·제조 공정', range: [60, 80] as [number, number] },
          { field: '고니켈 삼원계', range: [70, 100] as [number, number] },
          { field: 'LFP 계열', range: [30, 50] as [number, number] },
          { field: '차세대(전고체 등)', range: [80, 100] as [number, number] },
        ]}
        config={{
          range: { label: '침해율 추정', color: 'var(--chart-1)' },
        }}
        xKey="field"
        dataKey="range"
        domain={[0, 100]}
        valueFormatter={(r) => `${r[0]}~${r[1]}%`}
      />
    ),
  },
]);
