import { ChartBarBasic } from '../../bar-basic';
import { ChartBarDiverging } from '../../extras/bar-diverging';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-e5-p6-revenue',
    title: '에코프로비엠 매출 궤적 — 44조 계약 반영',
    description:
      '2025년은 본문의 근사 표현("예상 약 3조 원")을 그대로 썼고, 2026년은 21장의 "2026년부터 연 10조 매출이다"를 ' +
      '대표값(10조)으로 썼다 — 본문은 "2026년부터 연 10조대"라고만 쓰고 정확한 연도별 수치를 주지 않는다. ' +
      '계획서 제목은 "삼성SDI 44조 계약 반영 매출 궤적"이라 되어 있으나, 44조 계약의 매출은 ' +
      '양극재를 공급하는 에코프로비엠 쪽에 찍히는 매출이라 본문 흐름에 맞춰 주체를 에코프로비엠으로 정정했다.',
    source:
      '22장 본문 「매출 추이로 보면 이런 그림이다」 문단 + 21장 「2026년부터 연 10조 매출이다」 문장',
    render: () => (
      <ChartBarBasic
        data={[
          { year: '2023', revenue: 7 },
          { year: '2024', revenue: 2.7 },
          { year: '2025(예상,근사)', revenue: 3 },
          { year: '2026~(계약 가세)', revenue: 10 },
        ]}
        config={{ revenue: { label: '에코프로비엠 매출', color: 'var(--chart-1)' } }}
        xKey="year"
        dataKey="revenue"
        valueFormatter={(n) => `${n}조 원`}
      />
    ),
  },
  {
    id: 'book2-e5-share-split',
    title: '한국 배터리 3사, 사용량 증감률 방향이 갈린다 (1~4월)',
    description:
      '한국 배터리 합산 점유율이 −4.6퍼센트포인트였다는 기사를 3사로 분해하면, 배터리 사용량 전년 대비 ' +
      '증감률 기준으로 방향이 갈린다: LG엔솔 +16.3%(테슬라 유럽 부진을 GM 등이 상쇄), SK온 +24.1%(현대차 호조), ' +
      '삼성SDI −11.2%(BMW의 정치적 전환). 헤드라인의 −4.6퍼센트포인트는 점유율 지표이고, 개별사 수치는 ' +
      '사용량 증감률이라 서로 다른 지표다.',
    source: '22장 본문 「"1~4월 한국 배터리 점유율 −4.6퍼센트포인트" 기사를 분해해 보자」 문단',
    render: () => (
      <ChartBarDiverging
        data={[
          { company: 'LG엔솔', change: 16.3 },
          { company: 'SK온', change: 24.1 },
          { company: '삼성SDI', change: -11.2 },
        ]}
        config={{
          change: { label: '변화' },
          positive: { label: '상승', color: 'var(--chart-2)' },
          negative: { label: '하락', color: 'var(--chart-5)' },
        }}
        xKey="company"
        dataKey="change"
        domain={[-15, 30]}
        valueFormatter={(n) => `${n > 0 ? '+' : ''}${n}%`}
      />
    ),
  },
]);
