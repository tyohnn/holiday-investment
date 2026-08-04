import { ChartBarDualAxis } from '../../bar-dual-axis';
import { ChartBarRange } from '../../extras/bar-range';
import { ChartLineMulti } from '../../line-multi';
import { ChartRadarMulti } from '../../radar-multi';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-h1-margin-reversal',
    title: '현대차·기아 분기 영업이익률 반전',
    description:
      '2023년 4분기 8.2%까지 내려갔던 현대차 이익률이 2024년 8.75%, 9.50%로 되돌아서며 "일시적 산물" 가설을 반박했다',
    source: '22장 본문 「그런데 데이터가 가설을 때렸다」 표',
    render: () => (
      <ChartLineMulti
        data={[
          { quarter: "23년 2Q", hyundai: 10.03, kia: 12.97 },
          { quarter: "23년 3Q", hyundai: 9.3, kia: 12.2 },
          { quarter: "23년 4Q", hyundai: 8.2, kia: 10.13 },
          { quarter: "24년 1Q", hyundai: 8.75, kia: 13.07 },
          { quarter: "24년 2Q", hyundai: 9.5, kia: 13.2 },
        ]}
        config={{
          hyundai: { label: '현대차', color: 'var(--chart-1)' },
          kia: { label: '기아', color: 'var(--chart-2)' },
        }}
        xKey="quarter"
        series={['hyundai', 'kia']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book1-h1-per-paradox',
    title: '현대차 PER 하락 vs 영업이익 증가',
    description:
      '영업이익이 2020년 2.4조에서 2023년 15.4조로 급증하는 동안 PER은 21.1배에서 3.2배로 떨어졌다 — 이익 급증과 저PER이 동시에 나타난 것 자체가 "시장이 이익 감소를 예상한다"는 1차 가설의 근거였다',
    source: '22장 본문 「2024년 1월 26일(주가 187,300원…) 기준으로 계산한 연도별 PER」 표',
    render: () => (
      <ChartBarDualAxis
        data={[
          { year: '2020', profit: 2.4, per: 21.1 },
          { year: '2021', profit: 6.7, per: 7.6 },
          { year: '2022', profit: 9.8, per: 5.1 },
          { year: '2023', profit: 15.4, per: 3.2 },
        ]}
        config={{
          profit: { label: '영업이익(조 원)', color: 'var(--chart-1)' },
          per: { label: 'PER(배)', color: 'var(--chart-2)' },
        }}
        xKey="year"
        barKey="profit"
        lineKey="per"
        barValueFormatter={(n) => `${n}조`}
        lineValueFormatter={(n) => `${n}배`}
      />
    ),
  },
  {
    id: 'book1-h1-nine-cell-range',
    title: '현대차·기아 아홉 칸 적정주가 범위',
    description:
      '성장률 3개 × 배수 3개, 아홉 칸 계산 결과의 최종 저·고 범위. 현대차는 당시 주가 199,900원(약 20.0만 원) 기준, 기아는 같은 절차의 범위만 본문에 있고 그 시점 주가는 본문에 없다',
    source: '22장 본문 「아홉 칸을 채운다」 절',
    render: () => (
      <ChartBarRange
        data={[
          { name: '현대차', range: [34.2, 72.3] as [number, number] },
          { name: '기아', range: [14.4, 28.4] as [number, number] },
        ]}
        config={{
          range: { label: '적정주가 범위(만 원)', color: 'var(--chart-3)' },
        }}
        xKey="name"
        dataKey="range"
        domain={[0, 80]}
        valueFormatter={(r) => `${r[0]}만~${r[1]}만원`}
      />
    ),
  },
  {
    id: 'book1-h1-samyang-vs-nongshim',
    title: '삼양식품 vs 농심 5지표',
    description:
      '단위가 %·%·%·%·배로 제각각이라 원값을 그대로 겹치면 왜곡된다. 지표별로 두 회사 중 높은 값을 100으로 두고 정규화했다 — 원값은 영업이익률(농심5% vs 삼양11.9%), ROE(6.3% vs 19.2%), 3년 매출성장률(10% vs 22%), 수출비중(31% vs 67%), PER(13.6배 vs 13.5배)이다. PER만은 낮을수록 저평가라 방향이 반대이므로, 다른 네 축과 달리 값이 작은 쪽(삼양 13.5배)을 100으로 두는 역수 정규화를 적용했다 — 그대로 정규화하면 실제로는 더 싼 삼양(13.5배)이 더 비싼 농심(13.6배)보다 낮은 점수로 표시되는 오류가 생긴다. 수익성·성장률·수출비중은 삼양이 압도적이고, PER(밸류에이션)도 역수 정규화하면 삼양이 근소하게 더 유리하다는 것이 이 장의 핵심 관찰이다',
    source: '22장 본문 「라면은 농심이라는 관성을 숫자로 깬다」 표',
    render: () => (
      <ChartRadarMulti
        data={[
          { metric: '영업이익률', nongshim: 42.0, samyang: 100.0 },
          { metric: 'ROE', nongshim: 32.8, samyang: 100.0 },
          { metric: '매출성장률(3년)', nongshim: 45.5, samyang: 100.0 },
          { metric: '수출비중', nongshim: 46.3, samyang: 100.0 },
          { metric: 'PER(낮을수록 저평가, 역수 정규화)', nongshim: 99.3, samyang: 100.0 },
        ]}
        config={{
          nongshim: { label: '농심', color: 'var(--chart-2)' },
          samyang: { label: '삼양식품', color: 'var(--chart-1)' },
        }}
        angleKey="metric"
        series={['nongshim', 'samyang']}
      />
    ),
  },
]);
