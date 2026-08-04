import { ChartBarBasic } from '../../bar-basic';
import { ChartPieBasic } from '../../pie-basic';
import { ChartRadarMulti } from '../../radar-multi';
import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-d2-capa-plan',
    title: '셀 3사 생산능력 계획',
    description: '한국 셀 3사가 공표한 생산능력 계획 (GWh)',
    source: '14장(D2) 본문 「크기 — 규모의 경제와 D램의 선례」 절, 생산능력 계획 표',
    render: () => (
      <ChartBarBasic
        data={[
          { company: 'LG엔솔', capacity: 540 },
          { company: 'SK온', capacity: 220 },
          { company: '삼성SDI', capacity: 150 },
        ]}
        config={{
          capacity: { label: '생산능력 계획', color: 'var(--chart-1)' },
        }}
        xKey="company"
        dataKey="capacity"
        valueFormatter={(n) => `${n}GWh`}
      />
    ),
  },
  {
    id: 'book2-d2-cell-share',
    title: '2024년 셀 세계 점유율 (중국 내수 제외)',
    description:
      '중국 내수(정부 보조 시장)를 뺀 세계 점유율. 합이 100%에 못 미치는 것은 표에 없는 군소·중국 내수 업체 몫이 남아 있기 때문(원문 그대로).',
    source: '14장(D2) 본문 「크기」 절',
    render: () => (
      <ChartPieBasic
        data={[
          { company: 'CATL', share: 27 },
          { company: 'LG엔솔', share: 24.6 },
          { company: 'SK온', share: 10.8 },
          { company: '파나소닉', share: 9.7 },
          { company: '삼성SDI', share: 8.6 },
          { company: 'BYD', share: 4.1 },
          { company: '테슬라', share: 2.2 },
        ]}
        config={{
          share: { label: '점유율' },
          CATL: { label: 'CATL', color: 'var(--chart-1)' },
          LG엔솔: { label: 'LG엔솔', color: 'var(--chart-2)' },
          SK온: { label: 'SK온', color: 'var(--chart-3)' },
          파나소닉: { label: '파나소닉', color: 'var(--chart-4)' },
          삼성SDI: { label: '삼성SDI', color: 'var(--chart-5)' },
          BYD: { label: 'BYD', color: 'var(--chart-1)' },
          테슬라: { label: '테슬라', color: 'var(--chart-2)' },
        }}
        dataKey="share"
        nameKey="company"
      />
    ),
  },
  {
    id: 'book2-d2-four-axes',
    title: '셀 4사 경쟁력 네 요소 채점',
    description:
      '개념형 차트 — 원문의 상/중/하 등급을 상=3점·중=2점·하=1점으로 치환했다. 원 등급: LG엔솔(크기 상·불량률 상·제품종류 상·수직계열화 중), 삼성SDI(중·상·중·하), SK온(중·중·하·하), 금양(하·중·하·상).',
    source: '14장(D2) 본문 「종합 채점표와 생존 시나리오」 절, 종합 채점표',
    render: () => (
      <ChartRadarMulti
        data={[
          { axis: '크기', LG엔솔: 3, 삼성SDI: 2, SK온: 2, 금양: 1 },
          { axis: '불량률', LG엔솔: 3, 삼성SDI: 3, SK온: 2, 금양: 2 },
          { axis: '제품 종류', LG엔솔: 3, 삼성SDI: 2, SK온: 1, 금양: 1 },
          { axis: '수직계열화', LG엔솔: 2, 삼성SDI: 1, SK온: 1, 금양: 3 },
        ]}
        config={{
          LG엔솔: { label: 'LG엔솔', color: 'var(--chart-1)' },
          삼성SDI: { label: '삼성SDI', color: 'var(--chart-2)' },
          SK온: { label: 'SK온', color: 'var(--chart-3)' },
          금양: { label: '금양', color: 'var(--chart-4)' },
        }}
        angleKey="axis"
        series={['LG엔솔', '삼성SDI', 'SK온', '금양']}
      />
    ),
  },
  {
    id: 'book2-d2-mcap',
    title: '셀 4사 + CATL 시가총액',
    description:
      '2024년 하반기 기준 시가총액. SK온은 별도 상장사가 아니라 SK이노베이션 시총으로 표기(원문 그대로).',
    source: '14장(D2) 본문 「이 채점표를 계산에 어떻게 쓰나」 절, 상대가치 문단',
    render: () => (
      <ChartBarHorizontal
        data={[
          { company: 'LG엔솔', mcap: 80 },
          { company: 'SK이노베이션', mcap: 21 },
          { company: '삼성SDI', mcap: 14 },
          { company: '금양', mcap: 0.7 },
          { company: 'CATL', mcap: 224 },
        ]}
        config={{
          mcap: { label: '시가총액', color: 'var(--chart-1)' },
        }}
        categoryKey="company"
        dataKey="mcap"
        categoryWidth={100}
        valueFormatter={(n) => `${n}조 원`}
      />
    ),
  },
]);
