import { ChartBarStackedExpand } from '../../bar-stacked-expand';
import { ChartPieBasic } from '../../pie-basic';
import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { ChartSlope } from '../../analysis/slope';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-d2-semi-share',
    title: '메모리 vs 시스템반도체 — 국가별 점유율',
    description:
      '같은 "반도체"라도 메모리(한국 60%)와 시스템반도체(한국 3%)의 점유율은 정반대다',
    source: '15장 본문 「② 점유율 확인이 가장 결정적이다」 표',
    render: () => (
      <ChartBarStackedExpand
        data={[
          { segment: '메모리 (시장의 23.88%)', korea: 0.6, usa: 0.28, japan: 0.09 },
          {
            segment: '시스템반도체 (시장의 76.12%)',
            usa: 0.7,
            europe: 0.09,
            taiwan: 0.08,
            korea: 0.03,
          },
        ]}
        config={{
          korea: { label: '한국', color: 'var(--chart-1)' },
          usa: { label: '미국', color: 'var(--chart-2)' },
          japan: { label: '일본', color: 'var(--chart-3)' },
          europe: { label: '유럽', color: 'var(--chart-4)' },
          taiwan: { label: '대만', color: 'var(--chart-5)' },
        }}
        xKey="segment"
        series={['korea', 'usa', 'japan', 'europe', 'taiwan']}
        valueFormatter={(n) => `${Math.round(n * 100)}%`}
      />
    ),
  },
  {
    id: 'book1-d2-ess-region',
    title: '미국 배터리 ESS는 없다 — 지역별 누적 설치량',
    description: '"한국 배터리의 주 타깃은 미국 ESS"라는 프레임을 데이터로 반증',
    source: '15장 본문 「데이터로 반증한 실제 사례」 표',
    render: () => (
      <ChartPieBasic
        data={[
          { region: '중국', gwh: 31.1 },
          { region: '기타', gwh: 19.1 },
          { region: '미국', gwh: 9.3 },
          { region: '유럽', gwh: 8.8 },
        ]}
        config={{
          중국: { label: '중국 (GWh)', color: 'var(--chart-1)' },
          기타: { label: '기타 (GWh)', color: 'var(--chart-2)' },
          미국: { label: '미국 (GWh)', color: 'var(--chart-3)' },
          유럽: { label: '유럽 (GWh)', color: 'var(--chart-4)' },
        }}
        dataKey="gwh"
        nameKey="region"
      />
    ),
  },
  {
    id: 'book1-d2-growth-baseline',
    title: '반도체 전체(7%) 대비 — 산업별 성장률',
    description: '기준선(반도체 전체 약 7%)과 나란히 놓으면 이야기의 온도가 갈린다',
    source:
      '15장 본문 「실제로 대 보기 — "K-AI·반도체" 이야기」 성장률 표',
    render: () => (
      <ChartBarHorizontal
        data={[
          { area: '반도체 전체(기준선)', growth: 7 },
          { area: '차량용 반도체(하단)', growth: 5.76 },
          { area: '차량용 반도체(상단)', growth: 11 },
          { area: 'AI 서버 출하량', growth: 20 },
          { area: '이차전지용 반도체 수요', growth: 24 },
          { area: '고성능 메모리(2024~29년)', growth: 22 },
          { area: '이차전지 생산량', growth: 27 },
          { area: '고성능 메모리(2022~29년 전체)', growth: 46 },
        ]}
        config={{ growth: { label: '연평균 성장률', color: 'var(--chart-1)' } }}
        categoryKey="area"
        dataKey="growth"
        categoryWidth={190}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book1-d2-target-follows-price',
    title: '한미반도체 — 목표주가가 주가를 뒤따른다',
    description:
      '추정치를 먼저 정하는 게 아니라, 3개월 사이 주가가 내리자 목표가도 함께 내렸다 (3개월 뒤 주가는 본문의 "10만 원 근접" 표현을 반영한 근사치)',
    source: '15장 본문 「답을 먼저 정하고 숫자를 거꾸로 맞춘다」 표',
    render: () => (
      <ChartSlope
        data={[
          { point: '2024.7.16 발표', targetPrice: 300000, stockPrice: 157900 },
          { point: '2024.10.18 발표(약 3개월 후)', targetPrice: 170000, stockPrice: 100000 },
        ]}
        config={{
          targetPrice: { label: '목표주가', color: 'var(--chart-1)' },
          stockPrice: { label: '실제 주가(3개월 뒤는 근사치)', color: 'var(--chart-2)' },
        }}
        xKey="point"
        series={['targetPrice', 'stockPrice']}
        valueFormatter={(n) => `${n.toLocaleString()}원`}
      />
    ),
  },
]);
