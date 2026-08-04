import { ChartBarBasic } from '../../bar-basic';
import { ChartLineBasic } from '../../line-basic';
import { ChartLineReference } from '../../extras/line-reference';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-a1-battery-price',
    title: '배터리 가격 — kWh당 $1,000 → $156',
    description:
      '2010년 kWh당 1,000달러에서 2019년 156달러로 약 8분의 1로 떨어지며 전기차가 비로소 살 만한 가격에 진입했다',
    source:
      '1장 본문 「부활의 유일한 변수 — 배터리 가격」 표 — 2010년 kWh당 1,000달러 / 2019년 156달러',
    render: () => (
      <ChartBarBasic
        data={[
          { year: '2010', price: 1000 },
          { year: '2019', price: 156 },
        ]}
        config={{ price: { label: '배터리 가격(달러/kWh)', color: 'var(--chart-1)' } }}
        xKey="year"
        dataKey="price"
        valueFormatter={(n) => `${n}달러`}
      />
    ),
  },
  {
    id: 'book2-a1-tesla-arc',
    title: '테슬라 주가 궤적 — 상장부터 고점까지',
    description:
      '2008년 $1.4로 상장한 뒤 2013년 모델S 흥행(6→36달러), 2019년 연 30만 대 달성과 흑자 전환(11.8달러), 2020년 공매도 대학살(80→700달러 구간 급등)을 거쳐 2021년 11월 $414(상장가 대비 약 300배)에서 고점을 찍었다',
    source:
      '1장 본문 「테슬라의 주가와 실적 궤적이다」 표 — 2008 $1.4(상장) / 2013 $6→$36(모델S 본격 판매) / 2019 $11.8(연 30만대 달성·흑자전환) / 2020 $80→$700(보급형 성공·공매도 대학살) / 2021.11 $414(고점, 상장가 대비 약 300배)',
    render: () => (
      <ChartLineReference
        data={[
          { stage: '2008 상장', price: 1.4 },
          { stage: '2013 모델S 흥행 전', price: 6 },
          { stage: '2013 모델S 흥행 후', price: 36 },
          { stage: '2019 흑자 전환', price: 11.8 },
          { stage: '2020 공매도 대학살(저점)', price: 80 },
          { stage: '2020 공매도 대학살(고점)', price: 700 },
          { stage: '2021.11 고점', price: 414 },
        ]}
        config={{
          price: { label: '주가(달러)', color: 'var(--chart-1)' },
          event: { label: '공매도 대학살 구간', color: 'var(--chart-3)' },
        }}
        xKey="stage"
        dataKey="price"
        domain={[0, 750]}
        target={null}
        highlight={{ x1: '2020 공매도 대학살(저점)', x2: '2020 공매도 대학살(고점)' }}
        eventDot={{ x: '2019 흑자 전환', y: 11.8, label: '연 30만대 달성·흑자전환' }}
        valueFormatter={(n) => `${n}달러`}
      />
    ),
  },
  {
    id: 'book2-a1-ecopro-cycle',
    title: '에코프로 — 1차 붐과 2차 붐 (액면분할 전 기준)',
    description:
      '2009년 1,465원에서 2011년 11,000원(약 7.5배)까지 오른 뒤 2012~2019년 죽음의 계곡을 지나 2020년 이후 최고 150만 원까지 올랐다. 죽음의 계곡 구간은 본문에 구체적 주가가 없어 두 지점을 잇는 선이 실제로는 다년간의 침체를 건너뛴 것이다. 액면분할 전 기준 수치다',
    source:
      '1장 본문 「에코프로 사이클 — 새 기술 주가의 표준 패턴」 표 — 1차 상승 2009~2011(1,465원→11,000원, 약 7.5배) / 죽음의 계곡 2012~2019(침체, 구체적 수치 없음) / 2차 상승 2020~(최고 150만 원, 1차 저점 대비 약 1,000배)',
    render: () => (
      <ChartLineBasic
        data={[
          { stage: '2009 저점', price: 1465 },
          { stage: '2011 고점(1차 상승)', price: 11000 },
          { stage: '2020~ 고점(2차 상승)', price: 1500000 },
        ]}
        config={{ price: { label: '주가(원)', color: 'var(--chart-1)' } }}
        xKey="stage"
        dataKey="price"
        valueFormatter={(n) => `${n.toLocaleString()}원`}
      />
    ),
  },
]);
