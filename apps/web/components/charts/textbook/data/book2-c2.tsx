import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { ChartLineMulti } from '../../line-multi';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-c2-ira-path',
    title: 'IRA 30D — 광물·부품 요건 상향 경로',
    description:
      '본문은 시작값(2023년 광물 40%·부품 50%), 증가폭(매년 10%p), 종료값(2029년 광물 90%·부품 100%)만 제시하고 연도별 표는 없다. 이 세 값이 모두 맞물리려면 두 요건 모두 2028년에 종료값에 도달한 뒤 2029년까지 그 값을 유지(횡보)해야 한다 — 그 경로를 산출해 표시했다. 산출값이며 본문의 연도별 표가 아니다',
    source:
      '10장 본문 「30D의 두 요건은 매년 강도가 올라가도록 설계돼 있다」 절 — 연도별 수치는 시작·증가폭·종료값에서 산출',
    render: () => (
      <ChartLineMulti
        data={[
          { year: '2023', mineral: 40, component: 50 },
          { year: '2024', mineral: 50, component: 60 },
          { year: '2025', mineral: 60, component: 70 },
          { year: '2026', mineral: 70, component: 80 },
          { year: '2027', mineral: 80, component: 90 },
          { year: '2028', mineral: 90, component: 100 },
          { year: '2029', mineral: 90, component: 100 },
        ]}
        config={{
          mineral: { label: '광물 요건', color: 'var(--chart-1)' },
          component: { label: '부품 요건', color: 'var(--chart-2)' },
        }}
        xKey="year"
        series={['mineral', 'component']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book2-c2-tariff-table',
    title: '품목별 관세 취급 — 면제와 부과의 경계',
    description:
      '양극재·음극재는 면제(0%), 셀 완제품은 15%, 동박·알루미늄박은 구리 관세 50%가 그대로 남는다. 면제 자체가 "대체할 수 없다"는 미국의 자체 판정이자 해자의 외부 인증서로 읽힌다',
    source: '10장 본문 「품목별 취급표」',
    render: () => (
      <ChartBarHorizontal
        data={[
          { item: '양극재', rate: 0 },
          { item: '음극재', rate: 0 },
          { item: '셀 완제품', rate: 15 },
          { item: '동박·알루미늄박', rate: 50 },
        ]}
        config={{ rate: { label: '관세율', color: 'var(--chart-1)' } }}
        categoryKey="item"
        dataKey="rate"
        categoryWidth={110}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
