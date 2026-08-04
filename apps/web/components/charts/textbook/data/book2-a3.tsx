import { ChartBarBasic } from '../../bar-basic';
import { ChartBarGrouped } from '../../bar-grouped';
import { ChartLineDots } from '../../line-dots';
import { ChartPieDonut } from '../../pie-donut';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-a3-ncma-vs-lfp',
    title: 'NCMA 대 LFP — 에너지밀도',
    description:
      '같은 무게면 NCMA가 에너지 +85%, 같은 에너지면 무게 −46% — 305 대 165 Wh/kg',
    source: '3장 본문 「한국의 NCMA 305 대 중국의 LFP 165」 표',
    render: () => (
      <ChartBarBasic
        data={[
          { type: 'NCMA(한국)', density: 305 },
          { type: 'LFP(중국)', density: 165 },
        ]}
        config={{ density: { label: '에너지밀도(Wh/kg)', color: 'var(--chart-1)' } }}
        xKey="type"
        dataKey="density"
        valueFormatter={(n) => `${n}Wh/kg`}
      />
    ),
  },
  {
    id: 'book2-a3-density-roadmap',
    title: '세대별 에너지밀도 로드맵(Wh/kg)',
    description:
      '초기 리튬이온 80에서 하이니켈 240(초기의 3배), 울트라 하이니켈 300 Wh/kg까지 올랐다. 본문의 황화물계 전고체(약 900 Wh/L)는 부피 기준(Wh/L)으로 단위가 달라 이 차트(무게 기준 Wh/kg)에는 포함하지 않았다',
    source:
      '3장 본문 「차세대 기술도 목표는 같다」 표 — 초기 리튬이온(2011) 80 / 하이니켈(NCM811급) 약 240 / 울트라 하이니켈(NCM9½½) 약 300 Wh/kg. 황화물계 전고체 약 900 Wh/L(부피 기준)은 단위가 달라 제외',
    render: () => (
      <ChartLineDots
        data={[
          { generation: '초기 리튬이온(2011)', density: 80 },
          { generation: '하이니켈(NCM811급)', density: 240 },
          { generation: '울트라 하이니켈(NCM9½½)', density: 300 },
        ]}
        config={{ density: { label: '에너지밀도(Wh/kg)', color: 'var(--chart-1)' } }}
        xKey="generation"
        dataKey="density"
        valueFormatter={(n) => `${n}Wh/kg`}
      />
    ),
  },
  {
    id: 'book2-a3-lfp-price-by-region',
    title: '지역별 kWh당 단가 — LFP 대 NCM',
    description:
      '중국 내수는 LFP가 싸 보이지만(7~8만원 대 13만원대), 북미·유럽(12만~14만원 대 18만~20만원대)과 LG엔솔의 벤츠 공급 추정가(약 11만원대 대 약 14만원대)로 가면 격차가 좁혀진다 — 구간으로 제시된 값은 중앙값을 사용했다',
    source:
      '3장 본문 「LFP가 싼 게 아니라 중국에서 만든 LFP가 싸다」 표 — 중국 내수 LFP 7~8만원/NCM 13만원대, 북미·유럽 평균 LFP 12만~14만원/NCM 18만~20만원대, LG엔솔의 벤츠 공급 추정가 LFP 약 11만원대/NCM 약 14만원대',
    render: () => (
      <ChartBarGrouped
        data={[
          { region: '중국내수', LFP: 7.5, NCM: 13 },
          { region: '북미유럽', LFP: 13, NCM: 19 },
          { region: '벤츠공급가', LFP: 11, NCM: 14 },
        ]}
        config={{
          LFP: { label: 'LFP', color: 'var(--chart-1)' },
          NCM: { label: 'NCM(원통형)', color: 'var(--chart-2)' },
        }}
        xKey="region"
        series={['LFP', 'NCM']}
        valueFormatter={(n) => `${n}만원`}
      />
    ),
  },
  {
    id: 'book2-a3-benz-contract',
    title: '벤츠 25조 계약 — NCM 90% 대 LFP 10%',
    description:
      '46시리즈 원통형(NCM)이 23조 원(약 90%, 미국 애리조나 생산), LFP가 2조 원(약 10%, 폴란드 브로츠와프 생산)이다',
    source:
      '3장 본문 「벤츠 25조 계약이 말해 주는 것」 표 — 46시리즈 원통형(NCM) 23조원(약 90%, 미국 애리조나), LFP 2조원(약 10%, 폴란드 브로츠와프)',
    render: () => (
      <ChartPieDonut
        data={[
          { material: 'NCM', amount: 23 },
          { material: 'LFP', amount: 2 },
        ]}
        config={{
          amount: { label: '금액(조원)' },
          NCM: { label: 'NCM(46시리즈 원통형)', color: 'var(--chart-1)' },
          LFP: { label: 'LFP', color: 'var(--chart-2)' },
        }}
        dataKey="amount"
        nameKey="material"
      />
    ),
  },
]);
