import { ChartBarReference } from '../../bar-reference';
import { ChartBarGrouped } from '../../bar-grouped';
import { ChartLineBasic } from '../../line-basic';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-e2-penetration',
    title: '국가별 전기차 침투율 vs 캐즘 임계선 13.5%',
    description:
      '제프리 무어의 수용 곡선에서 캐즘 임계선은 누적 13.5퍼센트다. 미국은 그 경계에 있고, ' +
      '노르웨이·중국·유럽은 이미 넘었다. 국가별 침투율은 모두 본문의 근사·범위 표현을 수치화한 것이지만 ' +
      '성격이 같지 않다 — 미국(10%)·유럽(20%)·중국(60%)은 "약" 붙은 근사치인 반면, ' +
      '노르웨이(90%)는 본문이 "90퍼센트 이상"이라고 쓴 하한값이라 실제로는 그래프보다 더 높을 수 있다.',
    source: '19장 본문 「나라별 침투율을 13.5퍼센트 경계선과 비교하면 진단이 된다」 표(2024년 기준)',
    render: () => (
      <ChartBarReference
        data={[
          { market: '미국', penetration: 10 },
          { market: '유럽', penetration: 20 },
          { market: '중국', penetration: 60 },
          { market: '노르웨이', penetration: 90 },
        ]}
        config={{ penetration: { label: '전기차 침투율(근사·노르웨이는 하한값)', color: 'var(--chart-1)' } }}
        xKey="market"
        dataKey="penetration"
        goalValue={13.5}
        goalLabel="캐즘 임계선 13.5%"
        valueFormatter={(n) => (n === 90 ? `${n}%+` : `약 ${n}%`)}
      />
    ),
  },
  {
    id: 'book2-e2-utilization',
    title: '셀 3사 가동률 급락 (2023 → 2024)',
    description:
      '캐즘 구간에 3사 모두 가동률이 급락했다. 이익률 부진이 기술 열위가 아니라 가동률 문제라는 근거다.',
    source: '19장 본문 「캐즘 구간에 3사 가동률이 이렇게 급락했다」 문단',
    render: () => (
      <ChartBarGrouped
        data={[
          { company: 'LG엔솔', y2023: 69.3, y2024: 57.8 },
          { company: '삼성SDI', y2023: 76, y2024: 58 },
          { company: 'SK온', y2023: 87.7, y2024: 43.8 },
        ]}
        config={{
          y2023: { label: '2023년', color: 'var(--chart-3)' },
          y2024: { label: '2024년', color: 'var(--chart-5)' },
        }}
        xKey="company"
        series={['y2023', 'y2024']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book2-e2-lithium-cycle',
    title: '리튬 가격 사이클 — 3개 시점',
    description:
      '2018년 톤당 약 2만 달러 저점 → 2020년 가을부터 약 10배 급등한 고점(약 20만 달러, 저점의 10배로 환산) → ' +
      '현재는 고점 대비 8~10분의 1 수준이라는 본문 범위의 중간값(약 2.25만 달러)을 대표값으로 썼다. ' +
      '19장 본문에만 있는 3시점 요약이며, 다른 장(리튬 가격 사이클 상세)과는 별개 데이터다.',
    source: '19장 본문 「리튬은 2018년 톤당 약 2만 달러에서... 현재는 고점 대비 8분의 1에서 10분의 1 수준이다」 문단',
    render: () => (
      <ChartLineBasic
        data={[
          { point: '2018년(저점)', price: 20000 },
          { point: '2020~21년(고점, 근사)', price: 200000 },
          { point: '현재(근사)', price: 22500 },
        ]}
        config={{ price: { label: '리튬 가격(톤당)', color: 'var(--chart-2)' } }}
        xKey="point"
        dataKey="price"
        valueFormatter={(n) => `$${n.toLocaleString()}/톤`}
      />
    ),
  },
]);
