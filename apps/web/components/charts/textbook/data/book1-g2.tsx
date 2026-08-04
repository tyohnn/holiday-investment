import { ChartLineMulti } from '../../line-multi';
import { ChartWaterfall } from '../../analysis/waterfall';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-g2-account-bridge',
    title: '수익 인증 착시 — 계좌 기여도 브리지',
    description:
      '인증된 A종목(+80%, 비중 3%)은 계좌에 +2.4%포인트만 기여했고, 숨긴 B종목(−20%, 비중 40%)이 −8.0%포인트를 깎아 ' +
      '실제 계좌 합계는 −5.6%포인트다.',
    source: '21장 본문 「수익 인증 한 장으로 계좌 전체를 판단하지 마라」 표',
    render: () => (
      <ChartWaterfall
        steps={[
          { step: 'A종목 (+80%, 비중 3%)', delta: 2.4 },
          { step: 'B종목 (−20%, 비중 40%)', delta: -8.0 },
          { step: '실제 계좌 합계', delta: 0, total: true },
        ]}
        config={{
          value: { label: '변화', color: 'var(--chart-1)' },
          base: { label: '기준선', color: 'transparent' },
          increase: { label: '플러스 기여', color: 'var(--chart-2)' },
          decrease: { label: '마이너스 기여', color: 'var(--chart-5)' },
          total: { label: '계좌 합계', color: 'var(--chart-1)' },
        }}
        valueFormatter={(n) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%p`}
      />
    ),
  },
  {
    id: 'book1-g2-compound-58y',
    title: '연 20% vs 연 10%, 58년의 격차',
    description:
      '본문에는 연 20%(버핏)·연 10%(시장)와 58년 후 "약 154배" 차이만 나오고 연도별 수치는 없다. ' +
      '두 수익률로 직접 복리 계산(시작값=1)해 10년 단위 곡선을 그렸다. 58년 시점 계산값은 시장 약 252배, ' +
      '버핏 약 39,141배로 격차 약 155배 — 본문의 "약 154배"에 근사한다(검산 통과).',
    source: '21장 본문 「장기 성과는 짧은 구간에서 잘 보이지 않는다」 — 버핏 58년(1965~2022) 연 20% vs 시장 연 10%',
    render: () => (
      <ChartLineMulti
        data={[
          { year: '0년', market10: 1, buffett20: 1 },
          { year: '10년', market10: 2.6, buffett20: 6.2 },
          { year: '20년', market10: 6.7, buffett20: 38.3 },
          { year: '30년', market10: 17.4, buffett20: 237.4 },
          { year: '40년', market10: 45.3, buffett20: 1469.8 },
          { year: '50년', market10: 117.4, buffett20: 9100.4 },
          { year: '58년', market10: 251.7, buffett20: 39140.5 },
        ]}
        config={{
          market10: { label: '시장 평균 (연 10%)', color: 'var(--chart-2)' },
          buffett20: { label: '버핏 (연 20%)', color: 'var(--chart-1)' },
        }}
        xKey="year"
        series={['market10', 'buffett20']}
        valueFormatter={(n) => `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}배`}
      />
    ),
  },
]);
