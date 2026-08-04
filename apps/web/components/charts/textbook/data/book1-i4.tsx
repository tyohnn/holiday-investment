import { ChartBarGrouped } from '../../bar-grouped';
import { ChartBarRange } from '../../extras/bar-range';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-i4-lnf-transfer',
    title: '엘앤에프 이전상장 전후 주가 경로',
    description: '기대감에 미리 오르고, 이전상장 뒤 되돌린다',
    source:
      '29장 본문 「이전상장 주가는 기대가 먼저 오고 되돌림이 뒤따랐다」 표 — 12만~14만 원대 → 기대감 반영 약 20만 원 → 이전 상장일 14만~15만 원 → 이후 4만 7,000원',
    render: () => (
      <ChartBarRange
        data={[
          { phase: '기대감\n형성 전', range: [12, 14] as [number, number] },
          { phase: '기대감 반영\n(고점)', range: [20, 20] as [number, number] },
          { phase: '이전\n상장일', range: [14, 15] as [number, number] },
          { phase: '이후', range: [4.7, 4.7] as [number, number] },
        ]}
        config={{ range: { label: '주가', color: 'var(--chart-1)' } }}
        xKey="phase"
        dataKey="range"
        domain={[0, 22]}
        valueFormatter={(r) => (r[0] === r[1] ? `${r[0]}만원` : `${r[0]}~${r[1]}만원`)}
      />
    ),
  },
  {
    id: 'book1-i4-shortsell-resume',
    title: '공매도 재개 후 코스피 성과',
    description: '1개월 성과는 갈렸지만, 3개월 성과는 세 번 모두 플러스였다',
    source:
      '29장 본문 「장기 투자자는 만기 뉴스보다 회사의 숫자를 본다」 — 「과거 세 차례 공매도 재개 후 코스피 성과」 표',
    render: () => (
      <ChartBarGrouped
        data={[
          { year: '2009', oneMonth: 0.24, threeMonth: 14.7 },
          { year: '2011', oneMonth: 4.77, threeMonth: 10.6 },
          { year: '2021', oneMonth: 2.93, threeMonth: 2.84 },
        ]}
        config={{
          oneMonth: { label: '1개월 후', color: 'var(--chart-1)' },
          threeMonth: { label: '3개월 후', color: 'var(--chart-2)' },
        }}
        xKey="year"
        series={['oneMonth', 'threeMonth']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
