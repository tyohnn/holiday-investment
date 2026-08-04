import { ChartBarReference } from '../../bar-reference';
import { ChartBarStacked } from '../../bar-stacked';
import { ChartPieDonut } from '../../pie-donut';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-a2-margin-ladder',
    title: '삼양식품 — 안전마진 가격 사다리',
    description: '계산한 진입가와 적정주가, 그리고 실제로 찍은 저점·고점',
    source:
      '2장 본문 「실제로 해보기 — 삼양식품」 표 및 뒤이은 문단 (현재가·안전마진 진입가·3년 뒤 적정주가·실제 저점·실제 고점)',
    render: () => (
      <ChartBarReference
        data={[
          { label: '현재가(2024.12)', value: 219000 },
          { label: '안전마진 진입가', value: 195000 },
          { label: '실제 저점', value: 170000 },
          { label: '실제 고점', value: 718000 },
        ]}
        config={{
          value: { label: '주가', color: 'var(--chart-1)' },
        }}
        xKey="label"
        dataKey="value"
        goalValue={585000}
        goalLabel="3년 뒤 적정주가 58.5만원"
        valueFormatter={(n) => `${Math.round(n / 10000)}만원`}
      />
    ),
  },
  {
    id: 'book1-a2-tenbagger-math',
    title: '안정형 vs 십루타형 — 3년 뒤 결과',
    description: '1억 원을 다섯 종목에 2천만 원씩 나눠 넣었을 때, 종목별 결과의 합',
    source: '2장 본문 「이 비대칭이 결과를 어떻게 바꾸는지」 표 (안정형·십루타형 비교)',
    render: () => (
      <ChartBarStacked
        data={[
          {
            strategy: '안정형(5종목 각 +40%)',
            종목1: 2800,
            종목2: 2800,
            종목3: 2800,
            종목4: 2800,
            종목5: 2800,
          },
          {
            strategy: '십루타형(1종목 10배·3종목 본전·1종목 전액손실)',
            종목1: 20000,
            종목2: 2000,
            종목3: 2000,
            종목4: 2000,
            종목5: 0,
          },
        ]}
        config={{
          종목1: { label: '종목1', color: 'var(--chart-1)' },
          종목2: { label: '종목2', color: 'var(--chart-2)' },
          종목3: { label: '종목3', color: 'var(--chart-3)' },
          종목4: { label: '종목4', color: 'var(--chart-4)' },
          종목5: { label: '종목5', color: 'var(--chart-5)' },
        }}
        xKey="strategy"
        series={['종목1', '종목2', '종목3', '종목4', '종목5']}
        valueFormatter={(n) => `${n.toLocaleString()}만원`}
      />
    ),
  },
  {
    id: 'book1-a2-uncovered-universe',
    title: '상장 3,000개 중 애널리스트가 보는 곳',
    description: '증권사 보고서가 나오는 회사는 300개가 안 되고, 나머지 90%는 소외 영역이다',
    source:
      '2장 본문 「열 배가 되는 회사는 어디에 있는가」 — 「상장된 회사가 약 3,000개인데... 나머지 90퍼센트는 증권사 보고서가 드문 영역이다」',
    render: () => (
      <ChartPieDonut
        data={[
          { segment: '커버', ratio: 10 },
          { segment: '소외', ratio: 90 },
        ]}
        config={{
          ratio: { label: '비중' },
          커버: { label: '애널리스트 커버(300개 미만)', color: 'var(--chart-1)' },
          소외: { label: '보고서 드묾(약 90%)', color: 'var(--chart-3)' },
        }}
        dataKey="ratio"
        nameKey="segment"
      />
    ),
  },
]);
