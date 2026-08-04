import { ChartLineBasic } from '../../line-basic';
import { ChartBarGrouped } from '../../bar-grouped';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-e1-ecopro-run',
    title: '에코프로 주가 궤적 — 7만 원에서 150만 원까지',
    description:
      '2022년 6월 7만 원이던 주가가 2023년 7월 150만 원까지 21배 넘게 올랐다. ' +
      '2023.1중순 지점은 본문의 근사 표현("약 10만~11만 원")의 중간값(10.5만 원)이며, ' +
      '4.25 이후 "두 달 조정"으로 50만 원까지 내렸다는 지점은 본문에 정확한 날짜가 없어 ' +
      '"조정 저점(약 2개월 후)"으로만 표시했다.',
    source:
      '18장 본문 「상승의 해부 — 2022~23년 대시세」 표(2022.6.3, 2023.1 중순, 2023.4.11, 2023.4.25, 2023.7 행)',
    render: () => (
      <ChartLineBasic
        data={[
          { point: '2022.6.3', price: 7 },
          { point: '2023.1중순(근사)', price: 10.5 },
          { point: '2023.4.11(장중고점)', price: 80 },
          { point: '조정 저점(약 2개월 후)', price: 50 },
          { point: '2023.7', price: 150 },
        ]}
        config={{ price: { label: '에코프로 주가', color: 'var(--chart-1)' } }}
        xKey="point"
        dataKey="price"
        valueFormatter={(n) => `${n}만 원`}
      />
    ),
  },
  {
    id: 'book2-e1-flow-rotation',
    title: '8대 종목이 눌리는 동안 기관 보유 종목은 급등했다',
    description:
      '8대 종목(에코프로 등)이 눌린 6개월 동안, 수급이 이동한 기관 보유 종목(한미반도체·엔켐)은 ' +
      '6~7배 뛰었다. 8대 종목 쪽의 같은 기간 하락폭은 본문에 수치가 없어 표시하지 않았다 — ' +
      '이 차트는 반대편(기관 보유 종목)의 상승만 보여 준다.',
    source: '18장 본문 「실제로 8대 종목이 눌리는 동안 수급은 기관이 보유한 종목으로 이동했다」 문단',
    render: () => (
      <ChartBarGrouped
        data={[
          { stock: '한미반도체', before: 5.11, after: 19.62 },
          { stock: '엔켐', before: 6, after: 39.45 },
        ]}
        config={{
          before: { label: '6개월 전', color: 'var(--chart-3)' },
          after: { label: '6개월 후', color: 'var(--chart-1)' },
        }}
        xKey="stock"
        series={['before', 'after']}
        valueFormatter={(n) => `${n}만 원`}
      />
    ),
  },
]);
