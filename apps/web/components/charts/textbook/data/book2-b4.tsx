import { ChartBarGrouped } from '../../bar-grouped';
import { ChartLineDots } from '../../line-dots';
import { ChartPieDonut } from '../../pie-donut';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-b4-density-roadmap',
    title: '세대별 에너지밀도 로드맵',
    description:
      '초기 리튬이온부터 울트라 하이니켈까지 Wh/kg 기준 상승 추이. 표의 마지막 항목(황화물계 전고체 약 900)은 단위가 Wh/L로 앞의 세 값(Wh/kg)과 달라 이 차트에서는 제외했다',
    source:
      '8장 본문 표 「구분 / 에너지밀도 / 비고」 — 초기 리튬이온(닛산 리프 2011) 80 Wh/kg, 현재 NCM811급 약 240 Wh/kg, 울트라 하이니켈 NCM9½½ 약 300 Wh/kg (황화물계 전고체 약 900 Wh/L은 단위가 달라 제외)',
    render: () => (
      <ChartLineDots
        data={[
          { generation: '초기 리튬이온 (2011)', density: 80 },
          { generation: '현재 NCM811급', density: 240 },
          { generation: '울트라 하이니켈 9½½', density: 300 },
        ]}
        config={{ density: { label: '에너지밀도 (Wh/kg)', color: 'var(--chart-1)' } }}
        xKey="generation"
        dataKey="density"
        valueFormatter={(n) => `${n} Wh/kg`}
      />
    ),
  },
  {
    id: 'book2-b4-2035-mix',
    title: '2035년 배터리 시장 구성 전망',
    description:
      '전고체 침투율은 본문이 "9,040GWh 중 950GWh"로 정확한 수치를 제시해 그 값을 그대로 썼다(전고체 약 10.5%, 리튬이온 약 89.5%) — 본문의 개략치 "10~13%"·"87~90%"와 부합한다',
    source:
      '8장 본문 「침투율 전망」(2027년 양산 개시 → 2035년 전체의 10~13%, 9,040GWh 중 950GWh)과 「2035년에도 시장의 87~90퍼센트는 리튬이온이다」 문단',
    render: () => (
      <ChartPieDonut
        data={[
          { chemistry: '리튬이온', gwh: 8090 },
          { chemistry: '황화물계 전고체', gwh: 950 },
        ]}
        config={{
          gwh: { label: 'GWh' },
          리튬이온: { label: '리튬이온', color: 'var(--chart-1)' },
          '황화물계 전고체': { label: '황화물계 전고체', color: 'var(--chart-2)' },
        }}
        dataKey="gwh"
        nameKey="chemistry"
      />
    ),
  },
  {
    id: 'book2-b4-lisulfur-multiple',
    title: '리튬황 — 용량·밀도 배수',
    description:
      '양극 용량(황 1,675 대 NCM 약 200 mAh/g)과 음극 용량(리튬금속 약 3,500 대 흑연 350 mAh/g)은 원 단위 그대로 겹치면 자릿수 차이가 커 왜곡되므로, 본문이 이미 제시한 배수(약 8배·약 10배)로 표시했다. 에너지밀도는 본문의 "1.5배 이상"을 하한값으로 표시했다',
    source:
      '8장 본문 표 「리튬황」 — 양극 용량 황1,675 대 NCM약200(약 8배), 음극 용량 리튬금속약3,500 대 흑연350(약 10배), 무게당 에너지밀도 리튬이온 대비 1.5배 이상',
    render: () => (
      <ChartBarGrouped
        data={[
          { metric: '양극 용량', 배수: 8 },
          { metric: '음극 용량', 배수: 10 },
          { metric: '에너지밀도(하한)', 배수: 1.5 },
        ]}
        config={{ 배수: { label: '리튬이온/NCM 대비 배수', color: 'var(--chart-1)' } }}
        xKey="metric"
        series={['배수']}
        valueFormatter={(n) => `${n}배`}
      />
    ),
  },
]);
