import { ChartBarBasic } from '../../bar-basic';
import { ChartBarDiverging } from '../../extras/bar-diverging';
import { ChartBarGrouped } from '../../bar-grouped';
import { ChartBarReference } from '../../bar-reference';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-f3-breadth-gauge',
    title: '오른 종목 비율 지표 — 폭락 직전 임계선 대비',
    description:
      '2026년 상반기 오른 종목 비율 지표가 52까지 떨어져 코로나·리먼급 폭락 직전 수준(50)에 근접했다. ChartRadialGauge는 임계값을 표시할 수 없어, 임계선을 함께 그릴 수 있는 ChartBarReference로 바꿔 표현했다(계획서는 chart-radial-gauge였음)',
    source:
      '25장 본문 「사상 초유의 벌어짐」 표 — 오른 종목 비율 지표 52 vs 코로나·리먼급 폭락 직전(50) 수준',
    render: () => (
      <ChartBarReference
        data={[{ label: '오른 종목 비율 지표', value: 52 }]}
        config={{ value: { label: '지표값', color: 'var(--chart-1)' } }}
        xKey="label"
        dataKey="value"
        goalValue={50}
        goalLabel="폭락 직전 수준(50)"
        valueFormatter={(n) => `${n}`}
      />
    ),
  },
  {
    id: 'book2-f3-kospi-kosdaq',
    title: '2026년 상반기 코스피 vs 코스닥 등락률',
    description:
      '코스피 +101%, 코스닥 −1% — 사상 초유의 쏠림. 코스닥은 상반기 마감 이후(5월~7월 초) 별도로 추가 −40%(916→820) 더 하락했는데, 이는 상반기 마감 시점 이후의 다른 구간이라 이 차트의 상반기 수치에는 포함하지 않았다',
    source: '25장 본문 「사상 초유의 벌어짐」 표',
    render: () => (
      <ChartBarDiverging
        data={[
          { index: '코스피', change: 101 },
          { index: '코스닥', change: -1 },
        ]}
        config={{
          change: { label: '상반기 등락률' },
          positive: { label: '상승', color: 'var(--chart-2)' },
          negative: { label: '하락', color: 'var(--chart-5)' },
        }}
        xKey="index"
        dataKey="change"
        domain={[-10, 110]}
        valueFormatter={(n) => `${n > 0 ? '+' : ''}${n}%`}
      />
    ),
  },
  {
    id: 'book2-f3-china-nmc',
    title: '중국 삼원계 점유율 — LG엔솔 급등 vs CATL 하락',
    description:
      '2025년 4월→5월 한 달 새 LG엔솔 3.02%→11.47%(3배)로 뛰었고, 같은 기간 CATL은 82.52%→74.36%로 내려왔다',
    source: '25장 본문 「셀 — 중국 시장 역습과 저장장치」',
    render: () => (
      <ChartBarGrouped
        data={[
          { month: '4월', lgensol: 3.02, catl: 82.52 },
          { month: '5월', lgensol: 11.47, catl: 74.36 },
        ]}
        config={{
          lgensol: { label: 'LG엔솔(%)', color: 'var(--chart-1)' },
          catl: { label: 'CATL(%)', color: 'var(--chart-5)' },
        }}
        xKey="month"
        series={['lgensol', 'catl']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book2-f3-ess-region',
    title: '1분기 저장장치 지역별 출하량',
    description:
      '중국이 91.4GWh로 가장 크고 기타 아시아(41.8)·북미(32.7)·유럽(29.5)이 뒤를 잇는다 — 미국 데이터센터만의 시장이 아니다(1분기 세계 출하 +78%)',
    source: '25장 본문 「셀 — 중국 시장 역습과 저장장치」',
    render: () => (
      <ChartBarBasic
        data={[
          { region: '중국', shipment: 91.4 },
          { region: '기타 아시아', shipment: 41.8 },
          { region: '북미', shipment: 32.7 },
          { region: '유럽', shipment: 29.5 },
        ]}
        config={{ shipment: { label: '출하량(GWh)', color: 'var(--chart-1)' } }}
        xKey="region"
        dataKey="shipment"
        valueFormatter={(n) => `${n}GWh`}
      />
    ),
  },
]);
