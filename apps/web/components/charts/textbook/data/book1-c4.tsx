import { ChartBarBasic } from '../../bar-basic';
import { ChartBarRange } from '../../extras/bar-range';
import { ChartLineMulti } from '../../line-multi';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-c4-coupang-psr',
    title: '쿠팡 — 13년 적자에도 매출은 커졌다',
    description: '2013~2022년 누적 적자 6조 원 동안에도 매출은 계속 커졌고, 2024년 41조원 매출과 함께 흑자로 전환했다',
    source:
      '12장 본문 「성장 산업의 이익에는 다른 시간표가 있다」 표 — 2013~2022년 누적 적자 6조원, 같은 기간 매출 7→13→22→26→31→41조원, 2024년 매출 41조원과 함께 연 6천억원 흑자 전환. 본문에 연도별 손익 시계열이 없어 dual-axis(누적적자 라인) 대신 매출 단일 계열 막대로 대체',
    render: () => (
      <ChartBarBasic
        data={[
          { step: '①', revenue: 7 },
          { step: '②', revenue: 13 },
          { step: '③', revenue: 22 },
          { step: '④', revenue: 26 },
          { step: '⑤', revenue: 31 },
          { step: '2024년', revenue: 41 },
        ]}
        config={{ revenue: { label: '매출(조원)', color: 'var(--chart-1)' } }}
        xKey="step"
        dataKey="revenue"
        valueFormatter={(n) => `${n}조원`}
      />
    ),
  },
  {
    id: 'book1-c4-psr-bands',
    title: '성장산업별 PSR 정상 밴드 — 이차전지가 홀대받고 있다',
    description: 'AI·바이오·로봇 등 다른 성장 산업과 나란히 놓으면 이차전지 3사만 유독 낮다',
    source:
      '12장 본문 「미래 매출을 넣어야 PSR이 제구실한다」 — AI 반도체 8~12배, AI 소프트웨어 10~15배, 바이오 15~30배, 로봇 40배 이상(모두 현재 매출 기준), 이차전지 3사(LG에너지솔루션·삼성SDI·에코프로비엠)는 3년 뒤 매출 기준 0.7~1.5배',
    render: () => (
      <ChartBarRange
        data={[
          { industry: 'AI 반도체', range: [8, 12] as [number, number] },
          { industry: 'AI 소프트웨어', range: [10, 15] as [number, number] },
          { industry: '바이오', range: [15, 30] as [number, number] },
          { industry: '로봇', range: [40, 40] as [number, number] },
          { industry: '이차전지(3년 뒤)', range: [0.7, 1.5] as [number, number] },
        ]}
        config={{ range: { label: 'PSR(배)', color: 'var(--chart-1)' } }}
        xKey="industry"
        dataKey="range"
        domain={[0, 45]}
        valueFormatter={(r) => (r[0] === r[1] ? `${r[0]}배 이상` : `${r[0]}~${r[1]}배`)}
      />
    ),
  },
  {
    id: 'book1-c4-semi-psr',
    title: '삼성전자·SK하이닉스 PSR 하락의 서로 다른 이유',
    description: '삼성전자는 매출 정체로 PSR이 멈추고, SK하이닉스는 매출 급증으로 PSR이 계속 떨어진다',
    source: '12장 본문 「직접 계산해 보기 — 삼성전자와 SK하이닉스」 표 (2025/2026/2027년 PSR)',
    render: () => (
      <ChartLineMulti
        data={[
          { year: '2025', samsung: 2.5, skhynix: 5.8 },
          { year: '2026', samsung: 1.9, skhynix: 3.3 },
          { year: '2027', samsung: 1.9, skhynix: 2.9 },
        ]}
        config={{
          samsung: { label: '삼성전자', color: 'var(--chart-1)' },
          skhynix: { label: 'SK하이닉스', color: 'var(--chart-2)' },
        }}
        xKey="year"
        series={['samsung', 'skhynix']}
        valueFormatter={(n) => `${n}배`}
      />
    ),
  },
]);
