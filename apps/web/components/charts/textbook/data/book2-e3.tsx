import { ChartLineMulti } from '../../line-multi';
import { ChartBarDiverging } from '../../extras/bar-diverging';
import { ChartBarBasic } from '../../bar-basic';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-e3-capa-trajectory',
    title: '셀 3사 생산능력 궤적 (2023~2027)',
    description:
      '3사의 공시 연도가 서로 달라 SK온은 2025년 수치가 본문에 없다 — 그 해는 값을 비워 선이 끊긴다. ' +
      '삼성SDI의 2024년은 본문의 범위값("118~151GWh")의 중간값(134.5GWh)을 대표값으로 썼다.',
    source:
      '20장 본문 「종목별 계산 전체 재현」 — LG에너지솔루션·SK이노베이션(SK온)·삼성SDI 각 생산능력 궤적 문단',
    render: () => (
      <ChartLineMulti
        data={[
          { year: '2023', lgensol: 280, skon: 89, samsungsdi: 101 },
          { year: '2024', lgensol: 406, skon: 152, samsungsdi: 134.5 },
          { year: '2025', lgensol: 544, skon: undefined, samsungsdi: 207 },
          { year: '2026', lgensol: 634, skon: 273, samsungsdi: 243 },
          { year: '2027', lgensol: 700, skon: 300, samsungsdi: 270 },
        ]}
        config={{
          lgensol: { label: 'LG에너지솔루션', color: 'var(--chart-1)' },
          skon: { label: 'SK온', color: 'var(--chart-2)' },
          samsungsdi: { label: '삼성SDI', color: 'var(--chart-3)' },
        }}
        xKey="year"
        series={['lgensol', 'skon', 'samsungsdi']}
        valueFormatter={(n) => `${n}GWh`}
      />
    ),
  },
  {
    id: 'book2-e3-upside',
    title: '셀 3사 2027년 상승 여력',
    description:
      '20장 본문 「결과 요약」 표 값이다. 삼성SDI가 277퍼센트로 3사 중 최고다.',
    source: '20장 본문 「결과 요약」 표',
    render: () => (
      <ChartBarDiverging
        data={[
          { company: 'LG엔솔', upside: 141 },
          { company: 'SK이노베이션', upside: 253 },
          { company: '삼성SDI', upside: 277 },
        ]}
        config={{
          upside: { label: '2027년 상승 여력' },
          positive: { label: '상승 여력', color: 'var(--chart-2)' },
          negative: { label: '하락 여력', color: 'var(--chart-5)' },
        }}
        xKey="company"
        dataKey="upside"
        domain={[0, 400]}
        valueFormatter={(n) => `+${n}%`}
      />
    ),
  },
  {
    id: 'book2-e3-gwh-constant',
    title: 'GWh당 매출 상수 — 800억은 어디서 나왔나',
    description:
      '호황이었던 2023년(약 1,200억)과 부진했던 2024년(약 774억) 사이 어딘가로 2027년 가정 800억을 잡았다. 산술 중간값은 987억이며, 본문도 "중간값"이 아니라 "2023년보다는 낮게, 2024년보다는 높게 잡았다"고만 서술한다.',
    source: '20장 본문 「입력값 A — GWh당 매출 800억은 어디서 나왔나」 표',
    render: () => (
      <ChartBarBasic
        data={[
          { year: '2023', revenuePerGwh: 1200 },
          { year: '2024', revenuePerGwh: 774 },
          { year: '2027(가정)', revenuePerGwh: 800 },
        ]}
        config={{ revenuePerGwh: { label: 'GWh당 매출', color: 'var(--chart-1)' } }}
        xKey="year"
        dataKey="revenuePerGwh"
        valueFormatter={(n) => `${n}억 원`}
      />
    ),
  },
]);
