import { ChartBarRange } from '../../extras/bar-range';
import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { ChartPieDonut } from '../../pie-donut';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-d1-na-plants',
    title: '북미 합작공장 캐파 지도',
    description:
      '완공·가동 시점이 확인된 합작공장만 표시 — 용량(GWh) 미공개인 삼성SDI+GM(2026~27년 완공 목표)과 현대차그룹(이사회 발표만, 착공 미확인) 건은 제외했다.',
    source: '13장(D1) 본문 「북미 합작공장 지도」 표',
    render: () => (
      <ChartBarHorizontal
        data={[
          { plant: '얼티엄 1공장(오하이오, 가동 중)', capacity: 45 },
          { plant: '얼티엄 2공장(2023년 완공)', capacity: 50 },
          { plant: '얼티엄 3공장(2025년 양산)', capacity: 50 },
          { plant: '블루오벌SK 1공장(가동 중)', capacity: 28 },
          { plant: '블루오벌SK 켄터키·테네시(2025년 목표)', capacity: 125 },
        ]}
        config={{
          capacity: { label: '용량', color: 'var(--chart-1)' },
        }}
        categoryKey="plant"
        dataKey="capacity"
        categoryWidth={160}
        valueFormatter={(n) => `${n}GWh`}
      />
    ),
  },
  {
    id: 'book2-d1-capex-split',
    title: '셀 공장 공정별 투자 비중',
    description: '공장당 장비 투자 600~800억 원 기준 공정별 배분',
    source: '13장(D1) 본문 「밸류체인 전체 지도」 절',
    render: () => (
      <ChartPieDonut
        data={[
          { process: '전극', share: 30 },
          { process: '활성화', share: 29 },
          { process: '조립', share: 17 },
          { process: '기타(검사·포장 등)', share: 24 },
        ]}
        config={{
          share: { label: '투자 비중' },
          전극: { label: '전극', color: 'var(--chart-1)' },
          활성화: { label: '활성화', color: 'var(--chart-2)' },
          조립: { label: '조립', color: 'var(--chart-3)' },
          '기타(검사·포장 등)': { label: '기타(검사·포장 등)', color: 'var(--chart-4)' },
        }}
        dataKey="share"
        nameKey="process"
      />
    ),
  },
  {
    id: 'book2-d1-leadtime-bridge',
    title: '착공 → 공급 리드타임',
    description:
      '공장 건설(국내 18개월/미국 24개월) + 불량률 안정화(12~18개월) = 합계 약 3~3.5년(36~42개월). 연 단위 원문 수치를 개월로 환산했다.',
    source: '13장(D1) 본문 「리드타임 3~3.5년 — 시차의 계수」 절',
    render: () => (
      <ChartBarRange
        data={[
          { phase: '공장 건설', range: [18, 24] as [number, number] },
          { phase: '불량률 안정화', range: [12, 18] as [number, number] },
          { phase: '합계(착공→공급)', range: [36, 42] as [number, number] },
        ]}
        config={{
          range: { label: '기간', color: 'var(--chart-1)' },
        }}
        xKey="phase"
        dataKey="range"
        domain={[0, 48]}
        valueFormatter={(r) => `${r[0]}~${r[1]}개월`}
      />
    ),
  },
]);
