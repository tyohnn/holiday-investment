import { ChartBarBasic } from '../../bar-basic';
import { ChartBarDualAxis } from '../../bar-dual-axis';
import { ChartBarRange } from '../../extras/bar-range';
import { ChartWaterfall } from '../../analysis/waterfall';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-h4-psr-screen',
    title: 'PSR 스크리닝',
    description:
      '성숙 산업의 평균 PSR은 1~2배다. 서연이화·우신시스템은 그 20분의 1도 안 되고, 고마진 소프트웨어인 시프트업의 6.6배도 업종 통상(10배) 대비 저평가로 읽힌다',
    source: '25장 본문 「도구 2 — PSR」 표',
    render: () => (
      <ChartBarBasic
        data={[
          { stock: '서연이화', psr: 0.08 },
          { stock: '우신시스템', psr: 0.28 },
          { stock: '시프트업', psr: 6.6 },
        ]}
        config={{ psr: { label: 'PSR(배)', color: 'var(--chart-1)' } }}
        xKey="stock"
        dataKey="psr"
        valueFormatter={(n) => `${n}배`}
      />
    ),
  },
  {
    id: 'book1-h4-sammok',
    title: '삼목에스폼 3개년 매출·영업이익',
    description:
      '매출은 2년 만에 2배 이상, 영업이익은 37억에서 1,241억으로 약 34배 뛰었다. 2023년 영업이익률 28.25%는 매출·영업이익 값과 정확히 일치한다',
    source: '25장 본문 「삼목에스폼의 실측 숫자다」',
    render: () => (
      <ChartBarDualAxis
        data={[
          { year: '2021', revenue: 2000, profit: 37 },
          { year: '2022', revenue: 3377, profit: 681 },
          { year: '2023', revenue: 4394, profit: 1241 },
        ]}
        config={{
          revenue: { label: '매출(억 원)', color: 'var(--chart-1)' },
          profit: { label: '영업이익(억 원)', color: 'var(--chart-2)' },
        }}
        xKey="year"
        barKey="revenue"
        lineKey="profit"
        barValueFormatter={(n) => `${n}억`}
        lineValueFormatter={(n) => `${n}억`}
      />
    ),
  },
  {
    id: 'book1-h4-els-knockin',
    title: 'ELS 낙인 종목의 고점–저점 구간',
    description:
      '고점·저점이 모두 나오는 세 종목만 실었다(LG화학·현대차는 본문에 한쪽 값만 있어 제외). SK하이닉스는 본문의 "20만 원대"를 20만 원으로 표기했다. 낙인 만기 구간이 반복해서 역사적 바닥이었다',
    source: '25장 본문 「ELS 만기는 인위적인 매도 압력의 끝을 알려 준다」',
    render: () => (
      <ChartBarRange
        data={[
          { stock: 'SK하이닉스', range: [0.577, 20] as [number, number] },
          { stock: '네이버', range: [15.11, 46.5] as [number, number] },
          { stock: '이마트', range: [6.28, 19.15] as [number, number] },
        ]}
        config={{
          range: { label: '주가 구간(만 원)', color: 'var(--chart-3)' },
        }}
        xKey="stock"
        dataKey="range"
        domain={[0, 50]}
        valueFormatter={(r) => `${r[0]}만~${r[1]}만원`}
      />
    ),
  },
  {
    id: 'book1-h4-sgng-nav',
    title: 'SG&G 순자산가치 브리지',
    description:
      '시총 612억짜리 회사가 관계기업 지분·현금성 자산을 더하고 부채를 뺀 순자산가치는 약 3,300억 — 시총 대비 5~6배, 청산가치 기준으로는 시총의 541%다',
    source: '25장 본문 「SG&G 실계산이다」',
    render: () => (
      <ChartWaterfall
        steps={[
          { step: 'SG고료 지분', delta: 2625 },
          { step: 'GNS 지분', delta: 856 },
          { step: '현금성 자산', delta: 530 },
          { step: '부채', delta: -700 },
          { step: '순자산가치', delta: 0, total: true },
        ]}
        config={{
          value: { label: '증감', color: 'var(--chart-1)' },
          base: { label: '기준', color: 'transparent' },
          increase: { label: '증가', color: 'var(--chart-2)' },
          decrease: { label: '감소', color: 'var(--chart-5)' },
          total: { label: '합계', color: 'var(--chart-1)' },
        }}
        valueFormatter={(n) => `${n}억`}
      />
    ),
  },
]);
