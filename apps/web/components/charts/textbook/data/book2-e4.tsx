import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { ChartWaterfall } from '../../analysis/waterfall';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-e4-upside-ranking',
    title: '6종목 2027년 상승 여력 순위',
    description:
      '21장 본문의 「6종목 종합 서열」 표 그대로다. 가장 좋은 회사(LG엔솔)가 가장 낮은 상승 여력을 갖는다는 ' +
      '본문의 핵심 관찰이 이 순위에서 드러난다.',
    source: '21장 본문 「6종목 종합 서열」 표',
    render: () => (
      <ChartBarHorizontal
        data={[
          { stock: 'LG화학', upside: 514 },
          { stock: '에코프로비엠', upside: 370 },
          { stock: '삼성SDI', upside: 277 },
          { stock: '포스코퓨처엠', upside: 254 },
          { stock: 'SK이노베이션', upside: 253 },
          { stock: 'LG엔솔', upside: 141 },
        ]}
        config={{ upside: { label: '2027년 상승 여력', color: 'var(--chart-1)' } }}
        categoryKey="stock"
        dataKey="upside"
        categoryWidth={96}
        valueFormatter={(n) => `+${n}%`}
      />
    ),
  },
  {
    id: 'book2-e4-lgchem-sotp',
    title: 'LG화학 부분의 합(SOTP) 130.8조 vs 현재 시총 19.4조',
    description:
      '① LG엔솔 지분(지주 할인 반영) 79.3조 + ② 소재 사업(에코프로비엠 지분 환산) 37.5조 + ' +
      '③ 화학·바이오 본업(바닥 가치) 14조 = 130.8조(검산: 79.3+37.5+14=130.8, 본문과 일치). ' +
      '마지막 두 막대("시장의 저평가"와 "현재 시총")는 본문에 없는 항목으로, SOTP 합계 130.8조와 ' +
      '본문이 밝힌 현재 시총 19.4조의 차이(111.4조)를 시각화하려고 이 장이 계산해 추가했다.',
    source: '21장 본문 「LG화학 — 부분의 합으로 계산」 표 + 「적정주가 = 130.8조 ÷ 현 시총 19.4조 × 275,500원」 문장',
    render: () => (
      <ChartWaterfall
        steps={[
          { step: '① LG엔솔 지분', delta: 79.3 },
          { step: '② 소재 사업', delta: 37.5 },
          { step: '③ 화학·바이오 본업', delta: 14 },
          { step: 'SOTP 합계', delta: 0, total: true },
          { step: '시장의 저평가', delta: 19.4 - 130.8 },
          { step: '현재 시총', delta: 0, total: true },
        ]}
        config={{
          value: { label: '변화', color: 'var(--chart-1)' },
          base: { label: '기준선', color: 'transparent' },
          increase: { label: '가치 구성', color: 'var(--chart-2)' },
          decrease: { label: '시장 저평가분', color: 'var(--chart-5)' },
          total: { label: '합계', color: 'var(--chart-1)' },
        }}
        valueFormatter={(n) => `${n.toFixed(1)}조 원`}
      />
    ),
  },
]);
