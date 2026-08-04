import { ChartBarGrouped } from '../../bar-grouped';
import { ChartBarRange } from '../../extras/bar-range';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-c2-scenario-matrix',
    title: '아홉 칸 시나리오 매트릭스 — 현대차',
    description: '순이익 3케이스(연 7·10·13% 성장) × 적정 PER 3케이스(5·7·9배)의 3년 뒤 적정주가',
    source:
      '10장 본문 「실제로 끝까지 계산해 보기 — 현대차」 — 순이익 14.3/15.5/16.8조원 × PER 5/7/9배를 「3년 뒤 적정주가 = (3년 뒤 회사 값 ÷ 지금 회사 값 39.6조) × 지금 주가 187,300원」에 대입. 검산 예시(15.5조×7배=108.5조→51.3만원)와 정확히 일치. 아홉 칸의 계산값 범위는 33.8만~71.5만원으로, 본문이 제시한 최종 범위(34.2만~72.3만원)와는 각 계산 단계의 반올림이 누적되며 생긴 1%대 오차 안에서 근사한다. ChartHeatmapCorrelation은 −1~1 상관계수 색상 스케일과 행·열 공통 라벨의 대칭 정사각행렬을 전제해 이 표(순이익 축≠PER 축, 값이 상관계수가 아닌 주가)에 맞지 않아 ChartBarGrouped로 대체',
    render: () => (
      <ChartBarGrouped
        data={[
          { scenario: '경우1(7%)', per5: 33.8, per7: 47.3, per9: 60.9 },
          { scenario: '경우2(10%)', per5: 36.7, per7: 51.3, per9: 66.0 },
          { scenario: '경우3(13%)', per5: 39.7, per7: 55.6, per9: 71.5 },
        ]}
        config={{
          per5: { label: 'PER 5배', color: 'var(--chart-1)' },
          per7: { label: 'PER 7배', color: 'var(--chart-2)' },
          per9: { label: 'PER 9배', color: 'var(--chart-3)' },
        }}
        xKey="scenario"
        series={['per5', 'per7', 'per9']}
        valueFormatter={(n) => `${n}만원`}
      />
    ),
  },
  {
    id: 'book1-c2-fair-value-range',
    title: '5개 회사 3년 뒤 적정주가',
    description: '현대차·기아는 성장률×PER 아홉 칸의 범위, 나머지 셋은 생산능력 기반 단일 추정치',
    source:
      '10장 본문 「같은 공식이 다른 산업에도 그대로 통한다」 표 — 현대차 34.2만~72.3만원, 기아 14.4만~28.4만원, LG에너지솔루션 82.7만원(+208%), 삼성SDI 75.4만원(+371%), 에코프로비엠 54.7만원(+370%). 뒤의 세 회사는 본문에 아홉 칸이 아니라 단일 조합만 제시돼 있어 [v,v] 형태의 좁은 막대로 표시(범위가 아니라 점 추정임을 표시)',
    render: () => (
      <ChartBarRange
        data={[
          { company: '현대차', range: [34.2, 72.3] as [number, number] },
          { company: '기아', range: [14.4, 28.4] as [number, number] },
          { company: 'LG에너지솔루션', range: [82.7, 82.7] as [number, number] },
          { company: '삼성SDI', range: [75.4, 75.4] as [number, number] },
          { company: '에코프로비엠', range: [54.7, 54.7] as [number, number] },
        ]}
        config={{ range: { label: '적정주가(만원)', color: 'var(--chart-1)' } }}
        xKey="company"
        dataKey="range"
        domain={[0, 90]}
        valueFormatter={(r) => (r[0] === r[1] ? `${r[0]}만원(단일 추정)` : `${r[0]}만~${r[1]}만원`)}
      />
    ),
  },
]);
