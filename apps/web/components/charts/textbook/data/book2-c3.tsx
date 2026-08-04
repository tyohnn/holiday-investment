import { ChartBarDiverging } from '../../extras/bar-diverging';
import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { ChartBarRange } from '../../extras/bar-range';
import { ChartPieDonut } from '../../pie-donut';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-c3-byd-breakdown',
    title: 'BYD 430만 대 판매의 실체 — 순수 EV는 176만 대뿐',
    description:
      '본문이 명시한 순수 전기차 176만 대와 나머지(휘발유 겸용 합산) 254만 대를 표시했다. 두 값의 합은 본문이 제시한 전체 판매 430만 대와 일치한다',
    source: '11장 본문 「굴기의 실체 — 정치와 숫자 놀이」 표',
    render: () => (
      <ChartPieDonut
        data={[
          { group: 'pureEV', share: 176 },
          { group: 'mixed', share: 254 },
        ]}
        config={{
          share: { label: '판매(만 대)' },
          pureEV: { label: '순수 전기차', color: 'var(--chart-1)' },
          mixed: { label: '휘발유 겸용(합산)', color: 'var(--chart-3)' },
        }}
        dataKey="share"
        nameKey="group"
      />
    ),
  },
  {
    id: 'book2-c3-byd-financials',
    title: 'BYD 3분기 — 순이익 급감, 차입금 급증',
    description:
      '순이익 −32.6%, 매출 −3%, 장기차입금 +642%(전년 대비). 장기차입금의 스케일이 커서 매출 −3%는 축에서 거의 평평하게 보인다 — 정확한 증감률은 이 캡션의 수치로 확인할 것',
    source: '11장 본문 「프로파간다의 대가는 재무에 쌓였다」 항목',
    render: () => (
      <ChartBarDiverging
        data={[
          { metric: '순이익', change: -32.6 },
          { metric: '매출', change: -3 },
          { metric: '장기차입금', change: 642 },
        ]}
        config={{
          change: { label: '전년 대비 증감률' },
          positive: { label: '증가', color: 'var(--chart-2)' },
          negative: { label: '감소', color: 'var(--chart-5)' },
        }}
        xKey="metric"
        dataKey="change"
        domain={[-40, 650]}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book2-c3-utilization-cn-kr',
    title: '가동률 격차 — 중국 49.5% vs 한국 3사 약 60%',
    description:
      '중국 자동차 산업 평균 가동률(2024)이 한국 배터리 3사 평균보다 낮다. 한국 수치는 본문에 "약 60퍼센트"로 근사값 표기돼 있다',
    source: '11장 본문 「프로파간다의 대가는 재무에 쌓였다」',
    render: () => (
      <ChartBarHorizontal
        data={[
          { group: '중국 자동차 산업(2024)', rate: 49.5 },
          { group: '한국 배터리 3사(약)', rate: 60 },
        ]}
        config={{ rate: { label: '가동률', color: 'var(--chart-1)' } }}
        categoryKey="group"
        dataKey="rate"
        categoryWidth={140}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book2-c3-ebus-share',
    title: '전기버스 점유율 — 공식 43.8% vs 실질 60~70%',
    description:
      '실질 수치는 본문이 "약 60~70퍼센트"로 범위로 제시한 값이라 그대로 범위로 표시했다. 공식 43.8%는 브랜드 등록 기준, 실질은 반조립(구동축·배터리 등 핵심 부품 중국산) 포함 추정치다',
    source: '11장 본문 「점유율은 43.8퍼센트인가 70퍼센트인가」',
    render: () => (
      <ChartBarRange
        data={[
          { item: '공식(브랜드 등록 기준)', range: [43.8, 43.8] as [number, number] },
          { item: '실질(반조립 포함 추정)', range: [60, 70] as [number, number] },
        ]}
        config={{ range: { label: '중국산 비중', color: 'var(--chart-1)' } }}
        xKey="item"
        dataKey="range"
        domain={[0, 80]}
        valueFormatter={(r) => (r[0] === r[1] ? `${r[0]}%` : `${r[0]}~${r[1]}%`)}
      />
    ),
  },
]);
