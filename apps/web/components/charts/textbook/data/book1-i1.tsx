import { ChartPieDonut } from '../../pie-donut';
import { ChartTreemapBasic } from '../../treemap-basic';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-i1-geumyang-overhang',
    title: '금양 오버행 — 희석 물량 5.8%',
    description: '전환 물량 340만 주가 총 발행주식수에서 차지하는 비중',
    source:
      '26장 본문 「실전 사례 — 금양」 표 및 「직접 해보기」 「340만 ÷ 5,908만 ≈ 5.8퍼센트」',
    render: () => (
      <ChartPieDonut
        data={[
          { name: '신규 전환 물량', value: 5.8 },
          { name: '기존 발행주식', value: 94.2 },
        ]}
        config={{
          value: { label: '비중' },
          '신규 전환 물량': { label: '신규 전환 물량', color: 'var(--chart-5)' },
          '기존 발행주식': { label: '기존 발행주식', color: 'var(--chart-1)' },
        }}
        dataKey="value"
        nameKey="name"
      />
    ),
  },
  {
    id: 'book1-i1-stake-headroom',
    title: '지주사가 팔 수 있는 지분 여력',
    description:
      '자회사 지분율에서 지주회사 최소 요건(30%)을 뺀 만큼이 팔 수 있는 여력이다',
    source:
      '26장 본문 「자회사 가치는 지분율과 할인을 함께 반영한다」 — 에코프로(에코프로비엠 지분 45.58%, 최소요건 제외 후 약 15%p, 담보 물량 약 6%p, 전량 팔아도 39% 남음) / LG화학(LG엔솔 지분 81.82%, 최소요건 제외 후 51.82%p)',
    render: () => (
      <ChartTreemapBasic
        data={[
          {
            name: '에코프로 → 에코프로비엠 지분 45.58%',
            children: [
              { name: '지주회사 최소 요건 30%p', size: 30, fill: 'var(--chart-3)' },
              { name: '담보로 잡힌 물량 약 6%p', size: 6, fill: 'var(--chart-5)' },
              { name: '자유 매도 여력 약 9.58%p', size: 9.58, fill: 'var(--chart-1)' },
            ],
          },
          {
            name: 'LG화학 → LG에너지솔루션 지분 81.82%',
            children: [
              { name: '지주회사 최소 요건 30%p', size: 30, fill: 'var(--chart-3)' },
              { name: '자유 매도 여력 51.82%p', size: 51.82, fill: 'var(--chart-2)' },
            ],
          },
        ]}
        config={{ size: { label: '지분율(%p)', color: 'var(--chart-1)' } }}
      />
    ),
  },
]);
