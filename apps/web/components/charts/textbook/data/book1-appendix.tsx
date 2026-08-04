import { ChartLineMulti } from '../../line-multi';
import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-appendix-compound',
    title: '단리 vs 복리 — 10%·20%, 10·20·30·50년',
    description:
      '원금 1억 원 기준. 복리 20%는 50년 뒤 9,100억 원으로 단리 20%(11억 원)의 약 827배에 이른다.',
    source: '부록 본문 「복리로 보면 오늘의 소비 비용이 달라진다」 표 (원금 1억 원 기준)',
    render: () => (
      <ChartLineMulti
        data={[
          { year: '10년', simple10: 2, simple20: 3, compound10: 2.6, compound20: 6.2 },
          { year: '20년', simple10: 3, simple20: 5, compound10: 6.7, compound20: 38 },
          { year: '30년', simple10: 4, simple20: 7, compound10: 17, compound20: 237 },
          { year: '50년', simple10: 6, simple20: 11, compound10: 117, compound20: 9100 },
        ]}
        config={{
          simple10: { label: '단리 10%', color: 'var(--chart-3)' },
          simple20: { label: '단리 20%', color: 'var(--chart-4)' },
          compound10: { label: '복리 10%', color: 'var(--chart-2)' },
          compound20: { label: '복리 20%', color: 'var(--chart-1)' },
        }}
        xKey="year"
        series={['simple10', 'simple20', 'compound10', 'compound20']}
        valueFormatter={(n) => `${n.toLocaleString()}억원`}
      />
    ),
  },
  {
    id: 'book1-appendix-drawdowns',
    title: '빚투 금지의 근거 — 실제 낙폭',
    description:
      '반토막 정도가 아니라 최대 −95%까지 가정해야 한다는 근거. SK하이닉스는 5만 원(2007)→2,700원(2008) 하락률을 계산했다(−94.6%). ' +
      '코카콜라(1999~2010년 10년간 제자리)는 % 낙폭이 아니라서 제외했다.',
    source: '부록 본문 「빚은 단 한 번의 실패로 전부를 지운다 — "곱하기 0"」 표',
    render: () => (
      <ChartBarHorizontal
        data={[
          { name: '아마존 (닷컴 버블)', drawdown: -95 },
          { name: 'SK하이닉스 (2007→2008)', drawdown: -94.6 },
          { name: '삼성전자 (2008)', drawdown: -80 },
        ]}
        config={{ drawdown: { label: '낙폭', color: 'var(--chart-5)' } }}
        categoryKey="name"
        dataKey="drawdown"
        categoryWidth={140}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
