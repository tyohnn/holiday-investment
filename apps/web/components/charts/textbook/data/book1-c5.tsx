import { ChartBarReference } from '../../bar-reference';
import { ChartLineDualAxis } from '../../line-dual-axis';
import { ChartWaterfall } from '../../analysis/waterfall';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-c5-discount-ladder',
    title: '저평가 사다리 — 층마다 붙는 할인',
    description: '사업회사 값을 100으로 놓으면, 지주회사 경로에서 50%, 우선주 경로에서 그 위에 추가로 약 40%가 더 깎인다',
    source:
      '13장 본문 「아래층으로 갈수록 할인이 한 겹 더 붙는다」 표 — 1층 사업회사(LG에너지솔루션) 할인 0%, 2층 지주회사(LG화학) 지분가치의 약 50% 할인, 3층 지주회사 우선주(LG화학우) 보통주의 약 60%에서 거래(= 추가 40% 할인)',
    render: () => (
      <ChartWaterfall
        steps={[
          { step: '사업회사(=100)', delta: 100 },
          { step: '지주회사 할인(−50%)', delta: -50 },
          { step: '우선주 추가 할인(−40%)', delta: -20 },
          { step: '우선주(최종=30)', delta: 0, total: true },
        ]}
        valueFormatter={(n) => `${n}`}
      />
    ),
  },
  {
    id: 'book1-c5-lgchem-repeat',
    title: 'LG화학 — 지분가치 대비 비율과 상승여력 4시점',
    description:
      '비율이 낮을수록(2025.6, 52%) 상승여력이 가장 컸다(+90%). 2024.9 시점의 58%는 본문이 "58% 미만"이라 쓴 상한값을 대표값으로 표시한 것이다',
    source: '13장 본문 「한 번의 계산보다 시간에 따른 반복이 중요하다」 표 (2024.8~2025.7, 4개 시점)',
    render: () => (
      <ChartLineDualAxis
        data={[
          { point: '2024.8', ratio: 65, upside: 56 },
          { point: '2024.9', ratio: 58, upside: 72 },
          { point: '2025.6', ratio: 52, upside: 90 },
          { point: '2025.7', ratio: 63, upside: 58 },
        ]}
        config={{
          ratio: { label: '지분가치 대비(%)', color: 'var(--chart-1)' },
          upside: { label: '상승여력(%)', color: 'var(--chart-2)' },
        }}
        xKey="point"
        leftKey="ratio"
        rightKey="upside"
        leftValueFormatter={(n) => `${n}%`}
        rightValueFormatter={(n) => `+${n}%`}
      />
    ),
  },
  {
    id: 'book1-c5-pref-spread',
    title: '우선주 괴리율과 40% 기준선',
    description:
      '괴리율이 40%를 넘으면 우선주가, 이내면 보통주가 유리하다. LG화학우의 50%는 본문이 "30.5%에서 50% 초과로 확대"라 쓴 하한값을 대표값으로 표시한 것으로, 실제 괴리율은 이보다 더 클 수 있다',
    source:
      '13장 본문 「벌어진 차이를 괴리율로 표시한다」 표 — 삼성전자우 약 20%, 현대차2우B 27.4%, LG화학우 30.5%에서 50% 초과로 확대, LG생활건강우 56%, 아모레퍼시픽우 70%',
    render: () => (
      <ChartBarReference
        data={[
          { stock: '삼성전자우', gap: 20 },
          { stock: '현대차2우B', gap: 27.4 },
          { stock: 'LG화학우', gap: 50 },
          { stock: 'LG생활건강우', gap: 56 },
          { stock: '아모레퍼시픽우', gap: 70 },
        ]}
        config={{ gap: { label: '괴리율(%)', color: 'var(--chart-1)' } }}
        xKey="stock"
        dataKey="gap"
        goalValue={40}
        goalLabel="40% 기준선"
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
