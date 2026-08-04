import { ChartLineBasic } from '../../line-basic';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-a4-taco-bell',
    title: '타코벨 — 87% 하락을 견딘 6년',
    description: '린치는 14달러가 반토막 난 7달러부터 사기 시작해 1달러까지의 하락을 견뎠다',
    source:
      '4장 본문 「공부가 부족하면 떨어질 때 흔들린다」 — 14달러→7달러 매수 시작→1달러 최저점→6년 뒤 펩시코에 42달러 매각',
    render: () => (
      <ChartLineBasic
        data={[
          { stage: '매수 시작 전(고점)', price: 14 },
          { stage: '매수 시작', price: 7 },
          { stage: '최저점', price: 1 },
          { stage: '매도(6년 후)', price: 42 },
        ]}
        config={{
          price: { label: '주가(달러)', color: 'var(--chart-1)' },
        }}
        xKey="stage"
        dataKey="price"
        valueFormatter={(n) => `${n}달러`}
      />
    ),
  },
  {
    id: 'book1-a4-ecopro-cycle',
    title: '에코프로 — 15배 급등 뒤 3년 3개월 하락, 3주 반등',
    description: '2023년 2월 10만 원에서 6개월 만에 150만 원, 그 뒤 3년 3개월 하락 뒤 3주 만에 반등',
    source:
      '4장 본문 「상승은 아주 짧은 구간에 몰려 있다」 — 10만원(2023.2)→150만원(6개월후,15배)→3만7천원(3년3개월후 바닥)→9만원(3주 반등)',
    render: () => (
      <ChartLineBasic
        data={[
          { stage: '2023.2 저점', price: 10 },
          { stage: '6개월 후 고점(15배)', price: 150 },
          { stage: '3년 3개월 후 바닥', price: 3.7 },
          { stage: '3주 후 반등', price: 9 },
        ]}
        config={{
          price: { label: '주가(만원)', color: 'var(--chart-1)' },
        }}
        xKey="stage"
        dataKey="price"
        valueFormatter={(n) => `${n}만원`}
      />
    ),
  },
]);
