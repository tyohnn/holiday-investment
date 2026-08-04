import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { ChartRadarMulti } from '../../radar-multi';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-b1-2170-vs-4680',
    title: '2170 vs 4680 — 세 지표 비교',
    description:
      '개수·무게·출력은 단위와 방향이 전부 달라 원값을 그대로 겹치면 왜곡된다. 그래서 세 지표를 "2170 = 100" 기준 지수로 환산했다 — 개수·무게는 낮을수록 유리하므로 (2170값÷4680값)×100으로 방향을 뒤집어 지수화했고, 출력은 본문의 "약 6배"를 그대로 600으로 표시했다. 개수·무게는 본문이 범위(3,000~4,000개, 230~250kg 등)로 제시해 각 범위의 중앙값(2170: 3,500개·240kg, 4680: 950개·190kg)으로 지수를 계산했다.',
    source:
      '5장 본문 「기존 2170과 비교하면 이렇다」 표 — 차 한 대당 셀 개수(2170 3,000~4,000개 vs 4680 600~1,300개, 약 5분의 1), 팩 총무게(2170 230~250kg vs 4680 180~200kg), 출력(4680이 2170 대비 약 6배). 중앙값 기반 지수 환산치이며 원 범위는 위 설명 참고',
    render: () => (
      <ChartRadarMulti
        data={[
          { axis: '개수 개선 지수', '2170': 100, '4680': 368 },
          { axis: '무게 개선 지수', '2170': 100, '4680': 126 },
          { axis: '출력 지수', '2170': 100, '4680': 600 },
        ]}
        config={{
          '2170': { label: '2170 (기준=100)', color: 'var(--chart-1)' },
          '4680': { label: '4680', color: 'var(--chart-2)' },
        }}
        angleKey="axis"
        series={['2170', '4680']}
      />
    ),
  },
  {
    id: 'book2-b1-cell-count',
    title: '팩당 셀 개수 — 구조별 비교',
    description:
      '셀투팩으로 넘어간 4680이 각형(BMW) 수준까지 개수를 줄였다는 것을 보여준다',
    source:
      '5장 본문 「테슬라 기준으로 보면 차이가 뚜렷하다」(2170 모듈+팩 구조 팩당 약 4,300개, 4680 셀투팩 팩당 약 900개)와 「모델3의 원통형 4,300개 대비 BMW 각형은 약 700개」 문단',
    render: () => (
      <ChartBarHorizontal
        data={[
          { structure: '2170 (모듈+팩)', count: 4300 },
          { structure: '각형 (BMW)', count: 700 },
          { structure: '4680 (셀투팩)', count: 900 },
        ]}
        config={{ count: { label: '팩당 셀 개수', color: 'var(--chart-1)' } }}
        categoryKey="structure"
        dataKey="count"
        categoryWidth={110}
        valueFormatter={(n) => `약 ${n.toLocaleString()}개`}
      />
    ),
  },
]);
