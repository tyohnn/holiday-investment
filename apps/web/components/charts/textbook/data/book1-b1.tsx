import { ChartBarBasic } from '../../bar-basic';
import { registerTextbookCharts } from '../registry';

// book1-b1-industry-sieve(산업을 고르는 세 개의 체)는 건너뛴다.
// 본문은 세 가지 질문(성장성·한국 1위·저평가)을 서술할 뿐, 후보 산업이 각
// 단계를 거치며 몇 개로 좁혀지는지에 대한 실제 개수/수치를 제공하지 않는다.
// 유일한 숫자는 2024년 미국 전기차 침투율 "8~9퍼센트" 하나뿐이라 퍼널 형태의
// 단계별 수치를 지어내지 않고는 chart-extras-funnel-template을 채울 수 없다.

registerTextbookCharts([
  {
    id: 'book1-b1-shinyoung-aum',
    title: '신영자산운용 — 2차전지를 거품으로 단정한 대가',
    description: '2차전지를 공부하지 않고 낡은 잣대로 재단하며 운용자산이 94.7% 줄었다',
    source: '5장 본문 「능력범위는 넓혀 가는 것이다」 — 2023년 초 5,541억 원 → 같은 해 9월 294억 원',
    render: () => (
      <ChartBarBasic
        data={[
          { time: '2023년 초', aum: 5541 },
          { time: '2023년 9월', aum: 294 },
        ]}
        config={{
          aum: { label: '운용자산(억원)', color: 'var(--chart-1)' },
        }}
        xKey="time"
        dataKey="aum"
        valueFormatter={(n) => `${n.toLocaleString()}억원`}
      />
    ),
  },
]);
