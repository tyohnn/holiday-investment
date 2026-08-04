import { ChartBarBasic } from '../../bar-basic';
import { ChartBarGrouped } from '../../bar-grouped';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-f1-bottom3y-top3d',
    title: '바닥 3년, 천장 3일',
    description:
      '본문의 기간 표현(개월·보름·주)을 일수로 환산했다(1년=365일, 1개월=30일, 보름=15일, 1주=7일). ' +
      '에코프로는 하락 3년 3개월 ≈ 1,185일 vs 재상승(10/13~10/28) 보름=15일, ' +
      'LG에너지솔루션은 하락 2년=730일 vs 최근 재상승 2주=14일.',
    source: '19장 본문 「예측해서 팔면 짧은 상승 구간을 놓친다」 — 에코프로·LG에너지솔루션 하락·재상승 기간',
    render: () => (
      <ChartBarGrouped
        data={[
          { name: '에코프로', 하락기간: 1185, 상승기간: 15 },
          { name: 'LG에너지솔루션', 하락기간: 730, 상승기간: 14 },
        ]}
        config={{
          하락기간: { label: '하락 기간(일)', color: 'var(--chart-1)' },
          상승기간: { label: '재상승 기간(일)', color: 'var(--chart-2)' },
        }}
        xKey="name"
        series={['하락기간', '상승기간']}
        valueFormatter={(n) => `${n.toLocaleString()}일`}
      />
    ),
  },
  {
    id: 'book1-f1-walmart',
    title: '143배에서 팔았다면 놓쳤을 2,725배',
    description: '린치가 143배 시점에도 팔지 않은 월마트는 상장 후 44년간 총 2,725배가 됐다.',
    source: '19장 본문 「성장의 끝은 가격이 아니라 숫자로 정한다」 — 월마트, 143배 vs 상장 44년 후 2,725배',
    render: () => (
      <ChartBarBasic
        data={[
          { label: '143배 시점에 매도', multiple: 143 },
          { label: '44년 보유(실제)', multiple: 2725 },
        ]}
        config={{ multiple: { label: '상장 후 배수', color: 'var(--chart-1)' } }}
        xKey="label"
        dataKey="multiple"
        valueFormatter={(n) => `${n.toLocaleString()}배`}
      />
    ),
  },
]);
