import { ChartBarGrouped } from '../../bar-grouped';
import { ChartBullet, type BulletRow } from '../../analysis/bullet';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-e3-cash-backtest',
    title: '에코프로 — 몰빵 대비 "현금 20% 유지"의 수익률 차이',
    description:
      '매수가가 고점(20만 원)에 가까울수록 현금을 유지한 쪽이 더 유리했다 (수치는 몰빵 대비 %p 차이)',
    source: '18장 본문 「에코프로의 실제 경로로 규칙을 비교한다」 표',
    render: () => (
      <ChartBarGrouped
        data={[
          { buyPrice: '2만 원 매수', peak: -30, bottom: 20, current: 4 },
          { buyPrice: '10만 원 매수', peak: -16, bottom: 45, current: 26 },
          { buyPrice: '20만 원 매수', peak: -7, bottom: 32, current: 47 },
        ]}
        config={{
          peak: { label: '고점(30만 원) 시점', color: 'var(--chart-1)' },
          bottom: { label: '바닥(4만 원) 시점', color: 'var(--chart-2)' },
          current: { label: '현재(14만 원) 시점', color: 'var(--chart-3)' },
        }}
        xKey="buyPrice"
        series={['peak', 'bottom', 'current']}
        valueFormatter={(n) => `${n > 0 ? '+' : ''}${n}%p`}
      />
    ),
  },
  {
    id: 'book1-e3-buffett-indicator',
    title: '버핏지수 — 미국 vs 한국',
    description:
      '정성 구간(83/107/131/155%, 저평가~크게 고평가 5단계)을 저평가·정상·고평가 3단계로 압축해 표현했다. 미국은 크게 고평가(155% 초과) 구간, 한국은 크게 저평가(83% 미만) 구간에 있다',
    source: '18장 본문 「시장 전체의 보조 온도계인 버핏지수」 판정 구간 표 + 실제 적용 결과',
    render: () => {
      const data: BulletRow[] = [
        { metric: '미국', min: 0, poor: 83, ok: 155, max: 220, actual: 210, target: 155 },
        { metric: '한국', min: 0, poor: 83, ok: 155, max: 220, actual: 80, target: 83 },
      ];
      return (
        <ChartBullet
          data={data}
          config={{
            actual: { label: '버핏지수 실측치', color: 'var(--chart-1)' },
            target: { label: '저평가/고평가 기준선', color: 'var(--chart-2)' },
          }}
          valueFormatter={(n) => `${n}%`}
        />
      );
    },
  },
]);
