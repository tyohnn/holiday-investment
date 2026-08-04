import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { ChartTreemapBasic } from '../../treemap-basic';
import { ChartWaterfall } from '../../analysis/waterfall';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-i2-holdco-bridge',
    title: 'LG화학 지분가치 → 50% 할인 → 실제 시총',
    description:
      'LG엔솔 지분가치를 절반 할인해도, 실제 LG화학 시총은 그보다 더 낮게 거래됐다',
    source:
      '27장 본문 「LG화학은 본업 가치 없이도 쌌다」 표 (2025.6.10 기준) — LG엔솔 시총 67.5조 × 지분율 81.82% ≈ 55.2조 → 50% 할인 후 27.6조 → LG화학 시총 14.5조(할인 후 지분가치의 52%, 회복 시 +90%)',
    render: () => (
      <ChartWaterfall
        steps={[
          { step: 'LG엔솔 지분가치\n(할인 전)', delta: 55.2 },
          { step: '50% 할인', delta: -27.6 },
          { step: '할인 후 지분가치', delta: 0, total: true },
          { step: '시장의 추가 저평가', delta: -13.1 },
          { step: 'LG화학 실제 시총', delta: 0, total: true },
        ]}
        config={{
          value: { label: '변화', color: 'var(--chart-1)' },
          base: { label: '기준', color: 'transparent' },
          increase: { label: '증가', color: 'var(--chart-2)' },
          decrease: { label: '감소', color: 'var(--chart-5)' },
          total: { label: '합계', color: 'var(--chart-1)' },
        }}
        valueFormatter={(n) => `${n.toFixed(1)}조원`}
      />
    ),
  },
  {
    id: 'book1-i2-pref-spread',
    title: '종목별 보통주–우선주 괴리율',
    description: '보통주 대비 우선주가 얼마나 싸게 거래되는지 — 한국 평균은 약 40%',
    source:
      '27장 본문 「기관의 선택이 가격 차이를 움직인다」 표 — 삼성전자우 2024.12.24 종가 기준 17.4%, LG화학우는 2024년 말 30.5%(이후 50% 초과)',
    render: () => (
      <ChartBarHorizontal
        data={[
          { stock: '삼성전자우', gap: 17.4 },
          { stock: '현대차2우B', gap: 27.4 },
          { stock: 'LG화학우', gap: 30.5 },
          { stock: 'LG생활건강우', gap: 56 },
          { stock: '아모레퍼시픽우', gap: 70 },
        ]}
        config={{ gap: { label: '괴리율', color: 'var(--chart-1)' } }}
        categoryKey="stock"
        dataKey="gap"
        categoryWidth={110}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book1-i2-posco-parts',
    title: '포스코홀딩스 시총 구성',
    description: '상장 자회사 지분가치를 빼고 나면 철강 본업의 값이 드러난다',
    source:
      '27장 본문 「포스코홀딩스는 본업 가치를 따로 판단해야 한다」 표 (2025.6.10 기준) — 상장 자회사 지분가치 합계 6.0조 + 철강 본업·비상장 지분 15.4조 = 시총 21.4조',
    render: () => (
      <ChartTreemapBasic
        data={[
          {
            name: '포스코홀딩스 시총 21.4조',
            children: [
              {
                name: '상장 자회사 지분가치 (포스코퓨처엠·포스코인터내셔널, 50% 할인 후) 6.0조',
                size: 6.0,
                fill: 'var(--chart-1)',
              },
              {
                name: '철강 본업 + 비상장 지분 평가액 15.4조',
                size: 15.4,
                fill: 'var(--chart-3)',
              },
            ],
          },
        ]}
        config={{ size: { label: '시총(조원)', color: 'var(--chart-1)' } }}
      />
    ),
  },
]);
