import { ChartBarDiverging } from '../../extras/bar-diverging';
import { ChartBarGrouped } from '../../bar-grouped';
import { ChartScatterTrend } from '../../scatter-trend';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-f2-surprise',
    title: '소재사 1분기 영업이익 — 전망 대비 실제',
    description:
      '엘앤에프·에코프로비엠 모두 전망치의 2배 이상을 기록했다 (포스코퓨처엠은 흑자 전환만 확인되고 본문에 구체적 전망치 수치가 없어 제외)',
    source:
      '24장 본문 「소재사 실적 반등 — 채찍효과의 실증」 표 — 엘앤에프 전망 568억/실제 1,173억, 에코프로비엠 전망 92억/실제 209억',
    render: () => (
      <ChartBarGrouped
        data={[
          { company: '엘앤에프', forecast: 568, actual: 1173 },
          { company: '에코프로비엠', forecast: 92, actual: 209 },
        ]}
        config={{
          forecast: { label: '전망 영업이익(억 원)', color: 'var(--chart-3)' },
          actual: { label: '실제 영업이익(억 원)', color: 'var(--chart-1)' },
        }}
        xKey="company"
        series={['forecast', 'actual']}
        valueFormatter={(n) => `${n}억 원`}
      />
    ),
  },
  {
    id: 'book2-f2-used-ev',
    title: '미국 1분기 신차 vs 중고 전기차 판매 증감',
    description:
      '신차 전기차는 −28%(세액공제 폐지 여파)인데 중고 전기차는 +12% — 소비자가 전기차를 외면하는 게 아니라 신차가 비싸서 안 사는 것',
    source: '24장 본문 「중고 전기차 활황 — 피터 린치의 선행 지표」 표',
    render: () => (
      <ChartBarDiverging
        data={[
          { segment: '신차 전기차', delta: -28 },
          { segment: '중고 전기차', delta: 12 },
        ]}
        config={{
          delta: { label: '판매 증감률' },
          positive: { label: '증가', color: 'var(--chart-2)' },
          negative: { label: '감소', color: 'var(--chart-5)' },
        }}
        xKey="segment"
        dataKey="delta"
        domain={[-30, 15]}
        valueFormatter={(n) => `${n > 0 ? '+' : ''}${n}%`}
      />
    ),
  },
  {
    id: 'book2-f2-target-assumption',
    title: '에코프로비엠 2026 출하 성장률 가정 vs 목표주가',
    description:
      '증권사별 출하 성장률 가정이 높을수록 목표주가도 높다는 역추적 관계. 컴포넌트가 증권사명을 표시하지 못해 x축(성장률) 순서대로 밝힌다 — 삼성증권 "2025년 수준(소폭 감소)"→x=−3%(근사)·y=18만원, IBK "+22.9%"→x=22.9%·y="20만 초반"을 20.5만원(근사)으로, 교보증권 "+25~30%"→x=27.5%(구간 중간값)·y=25만원, 회사 목표 "+30% 이상"→x=31%(근사)·y="25만원 초과"를 26만원(근사)으로 표기했다',
    source: '24장 본문 「숫자가 찍히면 인식이 따라온다」 표',
    render: () => (
      <ChartScatterTrend
        data={[
          { x: -3, y: 18 },
          { x: 22.9, y: 20.5 },
          { x: 27.5, y: 25 },
          { x: 31, y: 26 },
        ]}
        config={{
          points: { label: '증권사 목표주가(만 원)', color: 'var(--chart-1)' },
          trend: { label: '추세선', color: 'var(--chart-2)' },
        }}
        xDomain={[-10, 40]}
        yDomain={[15, 30]}
      />
    ),
  },
]);
