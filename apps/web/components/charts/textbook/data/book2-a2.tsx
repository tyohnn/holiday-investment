import { ChartBarDualAxis } from '../../bar-dual-axis';
import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-a2-cathode-dominance',
    title: '4대 소재 — 시장 규모와 원가 비중',
    description:
      '양극재는 시장 규모(81.9, 나머지 셋 합 63.7)와 원가 비중(40%, 나머지 셋 합 36%) 모두에서 나머지 셋을 합친 것보다 크다. 시장 규모 수치는 본문에 단위가 표기돼 있지 않아 원문 숫자를 그대로 지수로 사용했다. 단위가 다른 두 지표(시장 규모 지수·원가 비중 %)라 막대·선 이중축으로 표현했다(계획서는 그룹형 막대를 제안했으나 단위 혼합을 피하기 위해 변경)',
    source:
      '2장 본문 「네 가지 소재를 해부한다」 표 — 양극재 81.9(시장규모)/40%(원가), 음극재 21.3/10%, 전해액 20.5/12%, 분리막 21.9/14%',
    render: () => (
      <ChartBarDualAxis
        data={[
          { material: '양극재', marketSize: 81.9, costShare: 40 },
          { material: '음극재', marketSize: 21.3, costShare: 10 },
          { material: '전해액', marketSize: 20.5, costShare: 12 },
          { material: '분리막', marketSize: 21.9, costShare: 14 },
        ]}
        config={{
          marketSize: { label: '시장 규모(지수, 단위 미기재)', color: 'var(--chart-1)' },
          costShare: { label: '원가 비중(%)', color: 'var(--chart-2)' },
        }}
        xKey="material"
        barKey="marketSize"
        lineKey="costShare"
        barValueFormatter={(n) => `${n}`}
        lineValueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book2-a2-cell-share',
    title: '셀 점유율 2024 (중국 내수 제외)',
    description:
      'CATL과 LG에너지솔루션이 0.7%포인트 차이로 접전이고, 한국 3사(LG엔솔·SK온·삼성SDI) 합계가 약 절반이다. 파나소닉은 성장률 −25.4%로 탈락 추세',
    source:
      '2장 본문 「지금 누가 하고 있나」 표(2024년 1~8월 누적, 중국 제외) — CATL 26.9%(중국 측 제출 자료라 부풀려졌을 수 있음)/LG에너지솔루션 26.2%/SK온 10.6%/삼성SDI 9.7%/파나소닉 약 9.7%(성장률 −25.4%)/BYD 3.9%',
    render: () => (
      <ChartBarHorizontal
        data={[
          { company: 'CATL', share: 26.9 },
          { company: 'LG에너지솔루션', share: 26.2 },
          { company: 'SK온', share: 10.6 },
          { company: '삼성SDI', share: 9.7 },
          { company: '파나소닉', share: 9.7 },
          { company: 'BYD', share: 3.9 },
        ]}
        config={{ share: { label: '점유율', color: 'var(--chart-1)' } }}
        categoryKey="company"
        dataKey="share"
        categoryWidth={110}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book2-a2-capa-vs-mcap',
    title: '양극재 4사 — 2025년 예상 캐파 vs 시가총액',
    description:
      '캐파 1위 에코프로비엠(32만 톤)이 2위 포스코퓨처엠(28만 톤)보다 시가총액은 낮다(17.2조 대 18.7조) — 생산능력 순위와 시총 순위가 어긋난다',
    source:
      '2장 본문 「양극재 네 회사 비교」 표 — 2025년 예상 캐파(만 톤/년)와 2024.10.14 시가총액(조 원): 에코프로비엠 32/17.2, 포스코퓨처엠 28/18.7, LG화학 21/24.7, 엘앤에프 20/약4',
    render: () => (
      <ChartBarDualAxis
        data={[
          { company: '에코프로비엠', capa2025: 32, marketCap: 17.2 },
          { company: '포스코퓨처엠', capa2025: 28, marketCap: 18.7 },
          { company: 'LG화학', capa2025: 21, marketCap: 24.7 },
          { company: '엘앤에프', capa2025: 20, marketCap: 4 },
        ]}
        config={{
          capa2025: { label: '2025년 예상 캐파(만톤/년)', color: 'var(--chart-1)' },
          marketCap: { label: '시가총액(조원, 2024.10.14)', color: 'var(--chart-2)' },
        }}
        xKey="company"
        barKey="capa2025"
        lineKey="marketCap"
        barValueFormatter={(n) => `${n}만톤`}
        lineValueFormatter={(n) => `${n}조원`}
      />
    ),
  },
]);
