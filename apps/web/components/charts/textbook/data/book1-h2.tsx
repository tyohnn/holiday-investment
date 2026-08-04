import { ChartBarBasic } from '../../bar-basic';
import { ChartBarGrouped } from '../../bar-grouped';
import { ChartLineMulti } from '../../line-multi';
import { ChartPieDonut } from '../../pie-donut';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-h2-hybe-collapse',
    title: '하이브 성장률 붕괴',
    description:
      '매출·영업이익 성장률이 여러 해에 걸쳐 둔화되다 2024년(매출 +1%, 영업이익 −30%)에 무너졌다. 본문은 "58 → 41 → 25 → 1퍼센트"처럼 연도 표기 없는 수열로만 앞 세 지점을 제시하며, 마지막 값(2024년)만 실적으로 명시한다. 앞 세 지점의 연도(2021~2023)는 성장률 하락이 그 붕괴 직전 몇 해에 걸쳐 일어났다는 서술을 바탕으로 이 차트가 역산해 붙인 것이며 본문에 직접 명시돼 있지 않다',
    source: '23장 본문 「세 문제가 겹치자 성장 엔진이 사라졌다」 문단, 2024년 실적은 같은 장 앞부분에 명시',
    render: () => (
      <ChartLineMulti
        data={[
          { period: '2021', revenueGrowth: 58, profitGrowth: 31 },
          { period: '2022', revenueGrowth: 41, profitGrowth: 25 },
          { period: '2023', revenueGrowth: 25, profitGrowth: 19 },
          { period: '2024', revenueGrowth: 1, profitGrowth: -30 },
        ]}
        config={{
          revenueGrowth: { label: '매출 성장률', color: 'var(--chart-1)' },
          profitGrowth: { label: '영업이익 성장률', color: 'var(--chart-5)' },
        }}
        xKey="period"
        series={['revenueGrowth', 'profitGrowth']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book1-h2-bts-share',
    title: '매출의 67%가 BTS',
    description: '2022년 하이브 전체 매출의 67%가 BTS 한 팀에서 나왔고, 나머지 20~30개 팀을 다 합쳐야 33%였다',
    source: '23장 본문 「압도적인 한 팀이 수십 팀을 앞선다」',
    render: () => (
      <ChartPieDonut
        data={[
          { group: 'bts', share: 67 },
          { group: 'others', share: 33 },
        ]}
        config={{
          share: { label: '매출 비중' },
          bts: { label: 'BTS', color: 'var(--chart-1)' },
          others: { label: '나머지 20~30개 팀', color: 'var(--chart-3)' },
        }}
        dataKey="share"
        nameKey="group"
      />
    ),
  },
  {
    id: 'book1-h2-label-mix',
    title: '레이블별 매출·순이익',
    description:
      '2024년 상반기 레이블별 매출·순이익(억 원). 빅히트(BTS·TXT)는 순이익 비중 44%로 사실상 1위지만 절대 순이익 금액이 본문에 없어 이 비교에서 제외했다',
    source: '23장 본문 레이블별 매출·이익 기여 표',
    render: () => (
      <ChartBarGrouped
        data={[
          { label: '플레디스', revenue: 1580, profit: 280 },
          { label: '어도어', revenue: 610, profit: 110 },
          { label: '빌리프랩', revenue: 550, profit: 160 },
          { label: '소스뮤직', revenue: 350, profit: 60 },
        ]}
        config={{
          revenue: { label: '매출(억 원)', color: 'var(--chart-1)' },
          profit: { label: '순이익(억 원)', color: 'var(--chart-2)' },
        }}
        xKey="label"
        series={['revenue', 'profit']}
        valueFormatter={(n) => `${n}억`}
      />
    ),
  },
  {
    id: 'book1-h2-lesserafim',
    title: '르세라핌 첫 주 음반 판매 궤적',
    description:
      '랜덤 포토카드·팬사인회 응모권으로 부풀린 밀어내기 판매가 사태 이후 얼마나 꺾였는지 보여 주는 실측 증거. 세 앨범의 공식 명칭은 본문에 없어 순서로만 표기했다',
    source: '23장 본문 「음반을 밀어내자 팬이 떠났다」',
    render: () => (
      <ChartBarBasic
        data={[
          { album: '첫 앨범', sales: 125.8 },
          { album: '두 번째 앨범', sales: 98.9 },
          { album: '사태 후 앨범', sales: 67.7 },
        ]}
        config={{ sales: { label: '첫 주 판매량(만 장)', color: 'var(--chart-1)' } }}
        xKey="album"
        dataKey="sales"
        valueFormatter={(n) => `${n}만 장`}
      />
    ),
  },
]);
