import { ChartTreemapBasic } from '../../treemap-basic';
import { ChartBarDiverging } from '../../extras/bar-diverging';
import { ChartBarRange } from '../../extras/bar-range';
import { ChartLineBasic } from '../../line-basic';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-e1-buffett-weights',
    title: '버핏의 실제 포트폴리오 비중',
    description: '상위 5종목이 78%, 업종은 네 개뿐 — 집중이 비정상이 아니라는 근거',
    source: '16장 본문 「버핏의 비중표는 집중이 드물지 않음을 보여 준다」 표',
    render: () => (
      <ChartTreemapBasic
        data={[
          {
            name: '버크셔 해서웨이 보유 비중',
            children: [
              { name: '애플 (IT)', size: 46.44 },
              { name: '뱅크오브아메리카 (금융)', size: 9 },
              { name: '아메리칸익스프레스 (금융)', size: 7.7 },
              { name: '코카콜라 (음식료)', size: 7.6 },
              { name: '셰브론 (정유)', size: 6.6 },
              { name: '옥시덴탈페트롤리엄 (정유)', size: 4 },
              { name: '크래프트하인즈 (음식료)', size: 3.8 },
              { name: '무디스 (금융)', size: 2.3 },
              { name: '액티비전블리자드 (게임)', size: 1 },
            ],
          },
        ]}
        config={{ size: { label: '비중(%)', color: 'var(--chart-1)' } }}
      />
    ),
  },
  {
    id: 'book1-e1-asset-200y',
    title: '자산별 200년 실질 연수익률',
    description: '현금(달러)은 물가를 감안하면 200년 동안 연 −1.4%였다',
    source: '16장 본문 「마이너스를 피하는 동안 큰 플러스도 멀어진다」 표 (시겔, 1802~2006년)',
    render: () => (
      <ChartBarDiverging
        data={[
          { asset: '주식', realReturn: 6.6 },
          { asset: '장기국채', realReturn: 3.6 },
          { asset: '단기국채', realReturn: 2.7 },
          { asset: '금', realReturn: 0.7 },
          { asset: '현금(달러)', realReturn: -1.4 },
        ]}
        config={{
          realReturn: { label: '실질 연수익률' },
          positive: { label: '플러스', color: 'var(--chart-2)' },
          negative: { label: '마이너스', color: 'var(--chart-5)' },
        }}
        xKey="asset"
        dataKey="realReturn"
        domain={[-3, 8]}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book1-e1-holding-range',
    title: '1년 보유 기준 — 자산별 최고·최저 수익률',
    description:
      '1년만 보면 주식이 가장 위험해 보인다(최저 −38.6%). 10년·20년 보유 시의 구체 수치는 본문에 없어 표시하지 않았다',
    source: '16장 본문 「시장 전체는 보유 기간이 길어질수록 손실 구간이 줄었다」 표 (1년 행)',
    render: () => (
      <ChartBarRange
        data={[
          { asset: '주식', range: [-38.6, 60.6] as [number, number] },
          { asset: '장기국채', range: [-21.9, 35] as [number, number] },
          { asset: '단기국채', range: [-15.6, 23.7] as [number, number] },
        ]}
        config={{ range: { label: '1년 보유 수익률 범위', color: 'var(--chart-3)' } }}
        xKey="asset"
        dataKey="range"
        domain={[-45, 65]}
        valueFormatter={(r) => `${r[0]}% ~ ${r[1]}%`}
      />
    ),
  },
  {
    id: 'book1-e1-age-rule',
    title: '주식 비중 = 100 − 나이',
    description: '나이가 들수록 주식 비중을 줄이는 기준선',
    source: '16장 본문 「1층 — 주식 비중은 나이와 사용 시점으로 정한다」 표',
    render: () => (
      <ChartLineBasic
        data={[
          { age: '30세', stockRatio: 70 },
          { age: '40세', stockRatio: 60 },
          { age: '54세', stockRatio: 46 },
          { age: '60세', stockRatio: 40 },
          { age: '70세', stockRatio: 30 },
        ]}
        config={{ stockRatio: { label: '주식 비중', color: 'var(--chart-1)' } }}
        xKey="age"
        dataKey="stockRatio"
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
