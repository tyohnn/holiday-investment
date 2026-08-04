import { ChartBarDualAxis } from '../../bar-dual-axis';
import { ChartBarRange } from '../../extras/bar-range';
import { ChartLineBasic } from '../../line-basic';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-b3-midnickel-reversal',
    title: 'NCM613 vs 811 vs 9½½ — 재료비·에너지밀도 역전',
    description:
      '고전압 미드니켈(NCM613)이 NCM811보다 밀도는 높으면서 재료비는 가장 싸다. NCM9½½의 작동 전압은 본문에 없어 이 차트(재료비·에너지밀도 비교)에는 사용하지 않았다',
    source:
      '7장 본문 「숫자로 보는 역전」 표(현대차증권 시뮬레이션) — NCM613 4.4V·밀도792·재료비22.6달러/kWh, NCM811 3.7V·밀도758·재료비31달러, NCM9½½ 밀도833·재료비28.05달러(전압 미기재)',
    render: () => (
      <ChartBarDualAxis
        data={[
          { material: 'NCM613 (고전압 미드니켈)', cost: 22.6, density: 792 },
          { material: 'NCM811', cost: 31, density: 758 },
          { material: 'NCM9½½', cost: 28.05, density: 833 },
        ]}
        config={{
          cost: { label: '재료비 (달러/kWh)', color: 'var(--chart-1)' },
          density: { label: '에너지밀도 (Wh/kg)', color: 'var(--chart-2)' },
        }}
        xKey="material"
        barKey="cost"
        lineKey="density"
        barValueFormatter={(n) => `$${n}`}
        lineValueFormatter={(n) => `${n}`}
      />
    ),
  },
  {
    id: 'book2-b3-nickel-lineage',
    title: '양극재 니켈 함량 20년 계보',
    description:
      '니켈 비율은 본문에 직접 쓰인 수치가 아니라 NCM 표기법에서 파생한 값이다 — NCM111은 니켈:코발트:망간=1:1:1이므로 니켈 약 33%, NCM523/622는 표기 그대로 니켈 50%/60%(중앙값 55% 표시), NCM811/9x는 니켈 80~90퍼센트 이상(중앙값 85% 표시)',
    source:
      '7장 본문 「양극재 조성이 걸어온 20년」 표 — NCM111(니켈:코발트:망간=1:1:1), NCM523/622(니켈 비중 상향), NCM811/9x(니켈 80~90퍼센트 이상)',
    render: () => (
      <ChartLineBasic
        data={[
          { generation: 'NCM111', nickel: 33 },
          { generation: 'NCM523/622', nickel: 55 },
          { generation: 'NCM811/9x', nickel: 85 },
        ]}
        config={{ nickel: { label: '니켈 비율', color: 'var(--chart-1)' } }}
        xKey="generation"
        dataKey="nickel"
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book2-b3-leadtime',
    title: '산업별 개발 리드타임',
    description:
      '리튬 광산·소금호수 개발과 신차 개발에 걸리는 시간을 반도체 공장과 나란히 놓았다. 범위로 제시된 값은 범위 그대로(막대의 최소~최대) 표시했다',
    source:
      '7장 본문 「왜 시간이 이렇게 오래 걸리나」 표 — 리튬 광산·소금호수 개발 최소 5~7년(소금호수 7년, 광산 5년), 반도체 공장 2~3년, 신차 개발 3~5년',
    render: () => (
      <ChartBarRange
        data={[
          { industry: '소금호수', range: [7, 7] as [number, number] },
          { industry: '광산', range: [5, 5] as [number, number] },
          { industry: '반도체', range: [2, 3] as [number, number] },
          { industry: '신차개발', range: [3, 5] as [number, number] },
        ]}
        config={{ range: { label: '개발 기간', color: 'var(--chart-1)' } }}
        xKey="industry"
        dataKey="range"
        domain={[0, 8]}
        valueFormatter={(r) => (r[0] === r[1] ? `${r[0]}년` : `${r[0]}~${r[1]}년`)}
      />
    ),
  },
]);
