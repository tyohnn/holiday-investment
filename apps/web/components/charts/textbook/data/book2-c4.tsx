import { ChartBarGrouped } from '../../bar-grouped';
import { ChartLineReference } from '../../extras/line-reference';
import { ChartLineDualAxis } from '../../line-dual-axis';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-c4-lithium-cycle',
    title: '탄산리튬 가격 사이클 — 14개 분기 평균',
    description:
      '분기 평균가가 34→541위안까지 뛰었다가 126위안까지 되돌아온 궤적. 본문은 이 14개 값의 순서만 제시하고 각 분기의 연도·분기 표기가 없어, x축은 상대적 순서(1~14분기)로 표기했다. 100위안은 본문이 명시한 업계 손익분기점(과거 지지선)이다. CATL 이춘 광산 폐쇄(2025.8, 반등 후 79.5위안/kg)는 이 14개 분기 시계열에 포함된 수치가 아니라서(별도 표의 최근 시점 값) 콜아웃으로 넣지 않았다',
    source:
      '12장 본문 「리튬 가격은 실제로 어떻게 움직였나」 절, 분기 평균 인용구 및 손익분기점 절',
    render: () => (
      <ChartLineReference
        data={[
          { quarter: '1분기', price: 34 },
          { quarter: '2분기', price: 39 },
          { quarter: '3분기', price: 70 },
          { quarter: '4분기', price: 81 },
          { quarter: '5분기', price: 106 },
          { quarter: '6분기', price: 190 },
          { quarter: '7분기', price: 403 },
          { quarter: '8분기', price: 446 },
          { quarter: '9분기', price: 468 },
          { quarter: '10분기', price: 541 },
          { quarter: '11분기', price: 359 },
          { quarter: '12분기', price: 233 },
          { quarter: '13분기', price: 232 },
          { quarter: '14분기', price: 126 },
        ]}
        config={{
          price: { label: '탄산리튬 평균가(위안/kg)', color: 'var(--chart-1)' },
          event: { label: '손익분기점', color: 'var(--chart-3)' },
        }}
        xKey="quarter"
        dataKey="price"
        domain={[0, 600]}
        target={{ value: 100, label: '손익분기점 100위안' }}
        highlight={null}
        eventDot={null}
        valueFormatter={(n) => `${n}위안`}
      />
    ),
  },
  {
    id: 'book2-c4-utilization-3y',
    title: '배터리 3사 가동률 — 2023~2025',
    description:
      '3사 모두 가동률이 하락하는 가운데, 이 정도 가동률이면 적자가 정상인데도 LG에너지솔루션만 이익을 내고 있어 상대적 우량함이 확인된다',
    source: '12장 본문 「광물 가격이 주가로 전달되는 경로」 절 표',
    render: () => (
      <ChartBarGrouped
        data={[
          { year: '2023', lg: 69.3, samsung: 76, skon: 87.7 },
          { year: '2024', lg: 57.8, samsung: 58, skon: 43.8 },
          { year: '2025 상반기', lg: 51.3, samsung: 44, skon: 52.2 },
        ]}
        config={{
          lg: { label: 'LG에너지솔루션', color: 'var(--chart-1)' },
          samsung: { label: '삼성SDI', color: 'var(--chart-2)' },
          skon: { label: 'SK온', color: 'var(--chart-3)' },
        }}
        xKey="year"
        series={['lg', 'samsung', 'skon']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book2-c4-albemarle-ecopro',
    title: '앨버말 ↔ 에코프로 — 리튬 사이클의 동행',
    description:
      '본문이 "같은 기간"으로 명시한 두 시점(2022년 리튬 고점기 → 2025년 4월 바닥)만 반영했다. 앨버말은 2016·2017·2020년 등의 값도 본문에 있지만 같은 시점의 에코프로 수치가 이 장에는 없어 제외했다 — 본문에 명시된 시점만 표시. 앨버말(330→50)은 약 6.6분의 1, 에코프로(30만→4만)는 약 7.5분의 1로 배율은 다르지만 방향과 낙폭의 크기는 비슷하다',
    source: '12장 본문 「리튬 가격과 주가는 정말 같이 가나」 절 (부분 정량)',
    render: () => (
      <ChartLineDualAxis
        data={[
          { point: '2022년(리튬 고점기)', albemarle: 330, ecopro: 30 },
          { point: '2025년 4월(바닥)', albemarle: 50, ecopro: 4 },
        ]}
        config={{
          albemarle: { label: '앨버말 주가($)', color: 'var(--chart-1)' },
          ecopro: { label: '에코프로 주가(만 원)', color: 'var(--chart-2)' },
        }}
        xKey="point"
        leftKey="albemarle"
        rightKey="ecopro"
        leftValueFormatter={(n) => `$${n}`}
        rightValueFormatter={(n) => `${n}만원`}
      />
    ),
  },
]);
