import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { ChartLineMulti } from '../../line-multi';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-b2-cathode-margin',
    title: '양극재 3사 영업이익률 4개년 추이',
    description: '같은 양극재를 만들어도 영업이익률의 격차가 해자의 유무를 보여 준다',
    source:
      '6장 본문 「이제 여섯 단계를 양극재 회사 셋에 적용해 보자」 표 — 4개 연도(마지막은 예상)의 영업이익률. 본문에 연도 표기는 없어 순서대로 1~4년차로 표시',
    render: () => (
      <ChartLineMulti
        data={[
          { year: '1년차', 에코프로비엠: 7.11, 포스코퓨처엠: 5.02, 엘앤에프: 6.85 },
          { year: '2년차', 에코프로비엠: 2.16, 포스코퓨처엠: 0.75, 엘앤에프: -4.79 },
          { year: '3년차', 에코프로비엠: -1.23, 포스코퓨처엠: 0.01, 엘앤에프: -29.29 },
          { year: '4년차(예상)', 에코프로비엠: 1.89, 포스코퓨처엠: 1.18, 엘앤에프: -7.42 },
        ]}
        config={{
          에코프로비엠: { label: '에코프로비엠', color: 'var(--chart-1)' },
          포스코퓨처엠: { label: '포스코퓨처엠', color: 'var(--chart-2)' },
          엘앤에프: { label: '엘앤에프', color: 'var(--chart-3)' },
        }}
        xKey="year"
        series={['에코프로비엠', '포스코퓨처엠', '엘앤에프']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book1-b2-ramen-margin',
    title: '삼양식품 vs 농심 영업이익률 4개년',
    description: '불닭볶음면은 특별한 제품, 신라면은 흔한 제품 — 이익률에 그대로 찍힌 차이',
    source:
      '6장 본문 「같은 절차를 산업 전체로 넓히면」 이후 라면 회사 표 — 삼양식품 9→12→19→24%, 농심 3.5→6.2→4.7→5.5%. 본문에 연도 표기는 없어 순서대로 1~4년차로 표시',
    render: () => (
      <ChartLineMulti
        data={[
          { year: '1년차', 삼양식품: 9, 농심: 3.5 },
          { year: '2년차', 삼양식품: 12, 농심: 6.2 },
          { year: '3년차', 삼양식품: 19, 농심: 4.7 },
          { year: '4년차', 삼양식품: 24, 농심: 5.5 },
        ]}
        config={{
          삼양식품: { label: '삼양식품', color: 'var(--chart-1)' },
          농심: { label: '농심', color: 'var(--chart-2)' },
        }}
        xKey="year"
        series={['삼양식품', '농심']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book1-b2-tariff-moat',
    title: '품목별 미국 관세율 — 해자 성적표',
    description: '면제된 품목일수록 미국이 "대체할 수 없다"고 인정한 것이다',
    source: '6장 본문 「관세표를 성적표로 읽는 법」 표 — 양극재·음극재 면제, 배터리 완제품 15%, 동박·알루미늄박(구리관세) 50%',
    render: () => (
      <ChartBarHorizontal
        data={[
          { item: '양극재', tariff: 0 },
          { item: '음극재', tariff: 0 },
          { item: '배터리 완제품', tariff: 15 },
          { item: '동박·알루미늄박', tariff: 50 },
        ]}
        config={{
          tariff: { label: '관세율', color: 'var(--chart-1)' },
        }}
        categoryKey="item"
        dataKey="tariff"
        categoryWidth={110}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
