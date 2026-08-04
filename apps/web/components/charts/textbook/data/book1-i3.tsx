import { ChartBarDiverging } from '../../extras/bar-diverging';
import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { ChartTreemapGrouped } from '../../treemap-grouped';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-i3-three-layers',
    title: '계좌 자산의 보관·보호·신용 3층',
    description:
      '도입부 계좌 예시(주식 3,000만 / 예수금 500만 / RP 2,000만 / ELS 1,000만 원)를 세 층으로 재분류',
    source:
      '28장 본문 도입부(계좌 잔고 예시) + 「계좌 안 자산은 세 층으로 나뉜다」 표',
    render: () => (
      <ChartTreemapGrouped
        data={[
          {
            name: '계좌 자산',
            children: [
              {
                name: '① 보관 층 — 한국예탁결제원',
                children: [{ name: '주식 3,000만원', size: 3000 }],
              },
              {
                name: '② 보호 층 — 예금보험공사',
                children: [{ name: '예수금 500만원', size: 500 }],
              },
              {
                name: '③ 신용 층 — 상대방 신용뿐',
                children: [
                  { name: 'RP 2,000만원', size: 2000 },
                  { name: 'ELS 1,000만원', size: 1000 },
                ],
              },
            ],
          },
        ]}
        config={{ size: { label: '금액(만원)', color: 'var(--chart-1)' } }}
      />
    ),
  },
  {
    id: 'book1-i3-deposit-limits',
    title: '국가별 예금자보호 한도',
    description: '한국의 한도는 다른 나라보다 낮았다 (원화 환산, 억원)',
    source:
      '28장 본문 「한국 한도가 낮았던 것은 사실이다」 표 — 한국 5,000만원(→ 1억원 이상으로 개정, 2026년 전후 시행 전망)',
    render: () => (
      <ChartBarHorizontal
        data={[
          { country: '미국', limit: 3 },
          { country: '독일', limit: 1.4 },
          { country: '영국', limit: 1.35 },
          { country: '일본', limit: 0.97 },
          { country: '캐나다', limit: 0.96 },
          { country: '한국', limit: 0.5 },
        ]}
        config={{ limit: { label: '보호 한도', color: 'var(--chart-1)' } }}
        categoryKey="country"
        dataKey="limit"
        categoryWidth={50}
        valueFormatter={(n) => `${n}억원`}
      />
    ),
  },
  {
    id: 'book1-i3-els-asymmetry',
    title: 'ELS 손익 비대칭 (+5% / −50%)',
    description: '벌면 확정 수익 5%, 낙인이 깨져 잃으면 하락률 전부(예: 50%)',
    source:
      '28장 본문 「왜 설계자가 이기나」 표 — 「벌면 5퍼센트, 잃으면 50퍼센트. 이기는 횟수가 많아 보여도, 한 번의 패배가 여러 번의 승리를 지운다」',
    render: () => (
      <ChartBarDiverging
        data={[
          { label: '벌 때(확정 수익)', payoff: 5 },
          { label: '잃을 때(낙인 붕괴)', payoff: -50 },
        ]}
        config={{
          payoff: { label: '손익률' },
          positive: { label: '벌 때(확정 수익)', color: 'var(--chart-2)' },
          negative: { label: '잃을 때(낙인 붕괴)', color: 'var(--chart-5)' },
        }}
        xKey="label"
        dataKey="payoff"
        domain={[-60, 10]}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
