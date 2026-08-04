import { ChartBarDualAxis } from '../../bar-dual-axis';
import { ChartBarReference } from '../../bar-reference';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-c3-lgc-revenue-check',
    title: 'LG에너지솔루션 매출 — 실제·추정·회사 목표 교차검증',
    description: '2027년 추정 매출(생산능력×환산값)이 회사가 밝힌 2028년 목표와 방향이 맞는지 확인한다',
    source:
      '11장 본문 「환산값은 실제 실적으로 다시 다듬는다」 표(2023년 매출 33.7조/2024년 25.6조, 2027년 가정 800억원/GWh×700GWh=56조)와 「계산 뒤에는 반드시 회사 목표와 맞춰 본다」(2028년 약 67조, 2023년 대비 2배)',
    render: () => (
      <ChartBarReference
        data={[
          { year: '2023(실적)', revenue: 33.7 },
          { year: '2024(실적)', revenue: 25.6 },
          { year: '2027(추정)', revenue: 56 },
        ]}
        config={{ revenue: { label: '매출(조원)', color: 'var(--chart-1)' } }}
        xKey="year"
        dataKey="revenue"
        goalValue={67}
        goalLabel="2028년 회사 목표(약 67조)"
        valueFormatter={(n) => `${n}조원`}
      />
    ),
  },
  {
    id: 'book1-c3-units-vs-twh',
    title: '대수 1위와 용량 1위가 뒤집힌다',
    description: '판매 대수는 중국이 1위지만, 배터리 용량(TWh)으로 환산하면 미국이 1위다',
    source:
      '11장 본문 「시장 크기는 대수가 아니라 금액으로 잰다」 표 — 미국 2,000만대·100kWh·2.0TWh, 중국 2,500만대·40kWh·1.0TWh, 유럽 1,500만대·60kWh·0.9TWh',
    render: () => (
      <ChartBarDualAxis
        data={[
          { region: '미국', units: 2000, twh: 2.0 },
          { region: '중국', units: 2500, twh: 1.0 },
          { region: '유럽', units: 1500, twh: 0.9 },
        ]}
        config={{
          units: { label: '연간 차 판매 대수(만대)', color: 'var(--chart-1)' },
          twh: { label: '배터리 시장 크기(TWh)', color: 'var(--chart-2)' },
        }}
        xKey="region"
        barKey="units"
        lineKey="twh"
        barValueFormatter={(n) => `${n}만대`}
        lineValueFormatter={(n) => `${n}TWh`}
      />
    ),
  },
]);
