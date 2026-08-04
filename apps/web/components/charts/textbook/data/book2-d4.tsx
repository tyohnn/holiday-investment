import { ChartPieDonut } from '../../pie-donut';
import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { ChartBarDualAxis } from '../../bar-dual-axis';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-d4-capex-split',
    title: '공정별 장비 투자 비중',
    description: '공장당 장비 투자(총 600~800억 원 기준) 배분',
    source: '16장(D4) 본문 「공정별 장비 지도」 절, 투자 비중 표',
    render: () => (
      <ChartPieDonut
        data={[
          { process: '전극', share: 30 },
          { process: '활성화', share: 29 },
          { process: '조립', share: 17 },
          { process: '기타(검사·포장)', share: 24 },
        ]}
        config={{
          share: { label: '투자 비중' },
          전극: { label: '전극', color: 'var(--chart-1)' },
          활성화: { label: '활성화', color: 'var(--chart-2)' },
          조립: { label: '조립', color: 'var(--chart-3)' },
          '기타(검사·포장)': { label: '기타(검사·포장)', color: 'var(--chart-4)' },
        }}
        dataKey="share"
        nameKey="process"
      />
    ),
  },
  {
    id: 'book2-d4-per-screen',
    title: 'PER 10배 미만 13종목 스크리닝',
    description:
      '계획서는 ChartScatterBubble(x=PER, y=매출성장률/영업이익률, z=시가총액)을 지정했지만, 본문 표는 13종목 전부에 대해 PER과 시가총액만 제공하고 매출성장률·영업이익률은 일부 종목(피엔티·CIS·우신시스템 등)에만 서술돼 13종목 공통 축으로 못 쓴다. 색으로 통과/탈락을 구분하는 것도 이 컴포넌트는 seriesKey 하나만 지원해 불가능하다. 이에 따라 PER 순위 ChartBarHorizontal로 낮춰 잡았다. 최종 통과 5선은 피엔티·CIS·윤성F&C·우신시스템·엔시스(최선호는 PER 3.0배의 우신시스템). 엔시스 시가총액은 본문 1차 표에 값이 없어 같은 장의 수주잔고 표(736억)에서 보완했다.',
    source: '16장(D4) 본문 「스크리닝 절차 — 13종목에서 5선까지」 절, PER 10배 미만 13종목 표 + 수주 잔고 표(엔시스 시총)',
    render: () => (
      <ChartBarHorizontal
        data={[
          { stock: '우신시스템', per: 3.0 },
          { stock: '톱텍', per: 4.2 },
          { stock: 'TSI', per: 5.1 },
          { stock: '기타', per: 5.5 },
          { stock: 'D&T', per: 6.3 },
          { stock: '피엔티', per: 7.0 },
          { stock: '윤성F&C', per: 7.0 },
          { stock: '엔시스', per: 7.3 },
          { stock: '아바코', per: 7.4 },
          { stock: '엠플러스', per: 8.2 },
          { stock: 'DIT', per: 8.7 },
          { stock: '코윈테크', per: 8.8 },
          { stock: 'CIS', per: 9.3 },
        ]}
        config={{
          per: { label: 'PER', color: 'var(--chart-1)' },
        }}
        categoryKey="stock"
        dataKey="per"
        categoryWidth={90}
        valueFormatter={(n) => `${n}배`}
      />
    ),
  },
  {
    id: 'book2-d4-backlog-multiple',
    title: '수주잔고 ÷ 시가총액 배수 vs PER',
    description:
      '피엔티는 본문의 배수 범위 "약 2.5~3배" 중 중간값 2.75배를 대표값으로 사용했다. 나머지는 원문의 단일 근사값(약 2배·약 1.5배·약 1.1배) 그대로.',
    source: '16장(D4) 본문 「장비주 전용 계산 — 수주 잔고 ÷ 시가총액」 절, 배수 표',
    render: () => (
      <ChartBarDualAxis
        data={[
          { company: '피엔티', multiple: 2.75, per: 5.7 },
          { company: 'CIS', multiple: 2, per: 11.7 },
          { company: '윤성에프앤씨', multiple: 1.5, per: 8.6 },
          { company: '엔시스', multiple: 1.1, per: 8.8 },
        ]}
        config={{
          multiple: { label: '수주잔고÷시총 배수', color: 'var(--chart-1)' },
          per: { label: 'PER', color: 'var(--chart-2)' },
        }}
        xKey="company"
        barKey="multiple"
        lineKey="per"
        barValueFormatter={(n) => `${n}배`}
        lineValueFormatter={(n) => `${n}배`}
      />
    ),
  },
  {
    id: 'book2-d4-wooshin',
    title: '우신시스템 매출·영업이익률 추이',
    description:
      '2021년은 영업이익률만 원문에 있어 매출 막대는 표시되지 않는다. 2025년 1분기는 분기 수치(연간과 단위가 다름).',
    source: '16장(D4) 본문 「별표 종목 우신시스템」 절, 숫자의 궤적 표',
    render: () => (
      <ChartBarDualAxis
        data={[
          { period: '2021년', margin: -4.4 },
          { period: '2023년', revenue: 2422, margin: 5.1 },
          { period: '2024년', revenue: 5636, margin: 6.4 },
          { period: '2025년 1분기', revenue: 1024, margin: 9 },
        ]}
        config={{
          revenue: { label: '매출', color: 'var(--chart-1)' },
          margin: { label: '영업이익률', color: 'var(--chart-2)' },
        }}
        xKey="period"
        barKey="revenue"
        lineKey="margin"
        barValueFormatter={(n) => `${n.toLocaleString()}억 원`}
        lineValueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
