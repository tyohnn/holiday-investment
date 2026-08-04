import { ChartBarDualAxis } from '../../bar-dual-axis';
import { ChartBarRange } from '../../extras/bar-range';
import { ChartScatterBubble } from '../../scatter-bubble';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-c1-per-paradox',
    title: '이익은 늘고 PER은 떨어진다 — 현대차',
    description: '2020~2023년 영업이익은 계속 늘었는데 PER은 21.1배에서 3.2배까지 내려왔다',
    source:
      '9장 본문 「이익이 정상으로 돌아가면 PER이 얼마가 되는가 — 현대차」 표 (2024.1.26 기준, 주가 187,300원·회사 값 39.6조원)',
    render: () => (
      <ChartBarDualAxis
        data={[
          { year: '2020', profit: 2.4, per: 21.1 },
          { year: '2021', profit: 6.7, per: 7.6 },
          { year: '2022', profit: 9.8, per: 5.1 },
          { year: '2023', profit: 15.4, per: 3.2 },
        ]}
        config={{
          profit: { label: '영업이익(조원)', color: 'var(--chart-1)' },
          per: { label: 'PER(배)', color: 'var(--chart-2)' },
        }}
        xKey="year"
        barKey="profit"
        lineKey="per"
        barValueFormatter={(n) => `${n}조`}
        lineValueFormatter={(n) => `${n}배`}
      />
    ),
  },
  {
    id: 'book1-c1-peg-scatter',
    title: '성장률 대비 PER — 네이버·카카오·에코프로비엠',
    description: 'PER 절대 수준이 아니라 성장률로 나눈 PEG로 보면 판정이 뒤집힌다',
    source:
      '9장 본문 「비싸다는 판정 — 네이버와 카카오」(3년 평균 영업이익 성장률·1년 뒤 PER)와 「싸다는 판정 — 에코프로비엠」(2020년 실적 기준 PER·이후 영업이익 성장률) 표. 버블 크기 = PEG(PER÷성장률)',
    render: () => (
      <ChartScatterBubble
        data={[
          { name: '네이버', growth: 6.9, per: 33.2, peg: 4.8 },
          { name: '카카오', growth: 7.7, per: 74.5, peg: 9.7 },
          { name: '에코프로비엠', growth: 106.6, per: 75.9, peg: 0.7 },
        ]}
        config={{
          bubble: { label: 'PEG', color: 'var(--chart-1)' },
          네이버: { label: '네이버' },
          카카오: { label: '카카오' },
          에코프로비엠: { label: '에코프로비엠' },
        }}
        xKey="growth"
        yKey="per"
        zKey="peg"
        nameKey="name"
        seriesKey="bubble"
      />
    ),
  },
  {
    id: 'book1-c1-global-auto-per',
    title: '세계 완성차 PER 비교',
    description:
      '전기차 비중이 높을수록 시장이 쳐 주는 배수도 높다. 유럽 평균 5배는 본문이 "대체로 5배 안팎"이라 쓴 근사치이며, 정확히 5배로 명시된 기아와는 정밀도가 다르다',
    source:
      '9장 본문 「적정 PER은 어떻게 정하는가」 절 — 테슬라 46배(최근 64배), BYD 24배, 토요타 8~9.2배, 혼다 7.3~10배, 현대차 5.4배, 기아 5배, 유럽 회사 대체로 5배 안팎',
    render: () => (
      <ChartBarRange
        data={[
          { company: '테슬라', range: [46, 64] as [number, number] },
          { company: 'BYD', range: [24, 24] as [number, number] },
          { company: '토요타', range: [8, 9.2] as [number, number] },
          { company: '혼다', range: [7.3, 10] as [number, number] },
          { company: '현대차', range: [5.4, 5.4] as [number, number] },
          { company: '기아', range: [5, 5] as [number, number] },
          { company: '유럽 평균', range: [5, 5] as [number, number] },
        ]}
        config={{ range: { label: 'PER(배)', color: 'var(--chart-1)' } }}
        xKey="company"
        dataKey="range"
        domain={[0, 70]}
        valueFormatter={(r) => (r[0] === r[1] ? `${r[0]}배` : `${r[0]}~${r[1]}배`)}
      />
    ),
  },
]);
