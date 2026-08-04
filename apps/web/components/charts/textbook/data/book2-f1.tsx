import { ChartBarBasic } from '../../bar-basic';
import { ChartBarDiverging } from '../../extras/bar-diverging';
import { ChartWaterfall } from '../../analysis/waterfall';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-f1-growth-bridge',
    title: '2026년 세계 전기차 시장 성장 기여도 분해 (중국 제외)',
    description:
      '유럽 +17.8%p, 북미 −2.5%p, 아시아·기타 +11.2%p를 더하면 2026년 성장률 +26.5% (17.8−2.5+11.2=26.5, 검산 일치)',
    source:
      '23장 본문 「2026년 성장률을 직접 계산해 보자」 표 — 지역별 비중(중국 제외) × 2026년 성장률 가정의 기여도',
    render: () => (
      <ChartWaterfall
        steps={[
          { step: '유럽 (비중 54%×+32.9%)', delta: 17.8 },
          { step: '북미 (비중 25%×−10%)', delta: -2.5 },
          { step: '아시아·기타 (비중 21%×+53.2%)', delta: 11.2 },
          { step: '2026년 성장률', delta: 26.5, total: true },
        ]}
        config={{
          base: { label: '누적', color: 'transparent' },
          value: { label: '증감', color: 'var(--chart-1)' },
          increase: { label: '성장 기여', color: 'var(--chart-2)' },
          decrease: { label: '역성장 기여', color: 'var(--chart-5)' },
          total: { label: '2026년 성장률', color: 'var(--chart-1)' },
        }}
        valueFormatter={(n) => `${n > 0 ? '+' : ''}${n}%`}
      />
    ),
  },
  {
    id: 'book2-f1-ev-vs-ess',
    title: 'LG엔솔 — 미국 전기차 감소 vs 저장장치 증가',
    description:
      '최악 시나리오(미국 전기차 −25%)를 가정해도 저장장치 매출 증가분(+2.2조 원)이 전기차 매출 감소분(−1.2조 원)을 웃돈다',
    source:
      '23장 본문 「저장장치가 전기차 감소를 못 메운다의 반박」 표 — LG엔솔 자체 공시 기준(2025년)',
    render: () => (
      <ChartBarDiverging
        data={[
          { segment: '전기차 (미국 −25% 가정)', delta: -1.2 },
          { segment: '저장장치 (생산능력 +67%)', delta: 2.2 },
        ]}
        config={{
          delta: { label: '매출 증감(조 원)' },
          positive: { label: '증가', color: 'var(--chart-2)' },
          negative: { label: '감소', color: 'var(--chart-5)' },
        }}
        xKey="segment"
        dataKey="delta"
        domain={[-2, 3]}
        valueFormatter={(n) => `${n > 0 ? '+' : ''}${n}조 원`}
      />
    ),
  },
  {
    id: 'book2-f1-us-ess-share',
    title: '미국 저장장치 배터리 점유율 — CATL 독주',
    description:
      'CATL 36.5% 대 LG엔솔 2.7%, 삼성SDI 3.3% — 관세 인상 전 무관세 중국산이 사실상 독식했다',
    source: '23장 본문 「미국 — 인공지능 데이터센터와 관세의 이중 구조」 — 저장장치 점유율',
    render: () => (
      <ChartBarBasic
        data={[
          { company: 'CATL', share: 36.5 },
          { company: '삼성SDI', share: 3.3 },
          { company: 'LG엔솔', share: 2.7 },
        ]}
        config={{ share: { label: '점유율(%)', color: 'var(--chart-1)' } }}
        xKey="company"
        dataKey="share"
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
