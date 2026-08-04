import { ChartBarGrouped } from '../../bar-grouped';
import { ChartBarDualAxis } from '../../bar-dual-axis';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-d3-material-size',
    title: '4대 소재 시장 규모·원가 비중',
    description:
      '시장 규모는 원문에 단위가 명시돼 있지 않아(소재 간 상대 비교용 지수), 원가 비중(%)만 값에 단위를 붙였다. 양극재 시장(81.9)은 나머지 셋의 합(63.7)보다 크고, 원가 비중(40%)도 나머지 셋의 합(36%)을 앞선다.',
    source: '15장(D3) 본문 「결론부터 — 소재별 지도가 가리키는 곳」 절, 시장 규모와 원가 비중 표',
    render: () => (
      <ChartBarGrouped
        data={[
          { material: '양극재', marketSize: 81.9, costShare: 40 },
          { material: '음극재', marketSize: 21.3, costShare: 10 },
          { material: '전해액', marketSize: 20.5, costShare: 12 },
          { material: '분리막', marketSize: 21.9, costShare: 14 },
        ]}
        config={{
          marketSize: { label: '시장 규모(지수)', color: 'var(--chart-1)' },
          costShare: { label: '원가 비중', color: 'var(--chart-2)' },
        }}
        xKey="material"
        series={['marketSize', 'costShare']}
      />
    ),
  },
  {
    id: 'book2-d3-country-share',
    title: '소재별 국가 점유율 — 한국이 이기는 건 양극재뿐',
    description:
      '한국 점유율과 해당 소재 세계 1위국 점유율 비교. 경쟁국은 소재마다 다르다 — 음극재는 중국(72%), 분리막은 일본(33.4%). 양극재는 한국이 세계 1위라 경쟁국 수치가 없다. 분리막 한국 점유율은 원문의 "10퍼센트대"를 10으로 표기.',
    source: '15장(D3) 본문 「국가 점유율 — 한국이 이기는 소재는 하나뿐」 절',
    render: () => (
      <ChartBarGrouped
        data={[
          { material: '양극재', korea: 30 },
          { material: '음극재', korea: 8, rival: 72 },
          { material: '분리막', korea: 10, rival: 33.4 },
        ]}
        config={{
          korea: { label: '한국 점유율', color: 'var(--chart-1)' },
          rival: { label: '해외 1위국 점유율', color: 'var(--chart-2)' },
        }}
        xKey="material"
        series={['korea', 'rival']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book2-d3-cathode-capa',
    title: '양극재 4사 생산능력 2021 → 2025',
    description: '단위 만 톤/년. 예상치인 2025년 수치를 포함한 원문 그대로.',
    source: '15장(D3) 본문 「양극재 네 회사」 절, 생산능력과 시가총액 표',
    render: () => (
      <ChartBarGrouped
        data={[
          { company: '에코프로비엠', y2021: 8, y2025: 32 },
          { company: '포스코퓨처엠', y2021: 6, y2025: 28 },
          { company: 'LG화학', y2021: 9, y2025: 21 },
          { company: '엘앤에프', y2021: 7, y2025: 20 },
        ]}
        config={{
          y2021: { label: '2021년', color: 'var(--chart-1)' },
          y2025: { label: '2025년(예상)', color: 'var(--chart-2)' },
        }}
        xKey="company"
        series={['y2021', 'y2025']}
        valueFormatter={(n) => `${n}만 톤`}
      />
    ),
  },
  {
    id: 'book2-d3-capa-vs-mcap',
    title: '양극재 4사 — 생산능력 순위 vs 시총 순위',
    description:
      '생산능력 1위인 에코프로비엠이 시총은 포스코퓨처엠·LG화학보다 낮다 — 순위가 어긋난 지점.',
    source: '15장(D3) 본문 「생산능력과 시가총액」 표',
    render: () => (
      <ChartBarDualAxis
        data={[
          { company: '에코프로비엠', capacity2025: 32, mcap: 17.2 },
          { company: '포스코퓨처엠', capacity2025: 28, mcap: 18.7 },
          { company: 'LG화학', capacity2025: 21, mcap: 24.7 },
          { company: '엘앤에프', capacity2025: 20, mcap: 4 },
        ]}
        config={{
          capacity2025: { label: '2025년 생산능력', color: 'var(--chart-1)' },
          mcap: { label: '시가총액', color: 'var(--chart-2)' },
        }}
        xKey="company"
        barKey="capacity2025"
        lineKey="mcap"
        barValueFormatter={(n) => `${n}만 톤`}
        lineValueFormatter={(n) => `${n}조 원`}
      />
    ),
  },
]);
