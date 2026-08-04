import { ChartBarGrouped } from '../../bar-grouped';
import { ChartRadarMulti } from '../../radar-multi';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-b3-cell-four-axes',
    title: '배터리 4사 경쟁력 — 네 개의 축',
    description: '규모·수율·제품 종류·원료부터 직접 하는가로 매긴 상/중/하 등급을 점수(상=3·중=2·하=1)로 바꿔 표시',
    source:
      '7장 본문 「네 축의 점수를 합치면 회사별 순위가 나온다」 표 — LG엔솔·삼성SDI·SK온·금양의 규모/수율/제품종류/원료부터 상·중·하 등급',
    render: () => (
      <ChartRadarMulti
        data={[
          { axis: '규모', LG엔솔: 3, 삼성SDI: 2, SK온: 2, 금양: 1 },
          { axis: '수율', LG엔솔: 3, 삼성SDI: 3, SK온: 2, 금양: 2 },
          { axis: '제품종류', LG엔솔: 3, 삼성SDI: 2, SK온: 1, 금양: 1 },
          { axis: '원료부터', LG엔솔: 2, 삼성SDI: 1, SK온: 1, 금양: 3 },
        ]}
        config={{
          LG엔솔: { label: 'LG엔솔', color: 'var(--chart-1)' },
          삼성SDI: { label: '삼성SDI', color: 'var(--chart-2)' },
          SK온: { label: 'SK온', color: 'var(--chart-3)' },
          금양: { label: '금양', color: 'var(--chart-4)' },
        }}
        angleKey="axis"
        series={['LG엔솔', '삼성SDI', 'SK온', '금양']}
      />
    ),
  },
  {
    id: 'book1-b3-hbm-gap',
    title: 'HBM 매출 기여도 vs 실제 주가 반영',
    description: '7퍼센트짜리 재료에 70퍼센트가 붙었다 — SK하이닉스는 기여도 6.7%에 주가 +70%로 반응했다',
    source:
      '7장 본문 「새 테마는 기존 매출과 나란히 놓아야 크기가 보인다」 표 — 삼성전자 기여도 1%, SK하이닉스 기여도 6.7%, SK하이닉스 실제 주가 반영 +70%(삼성전자의 실제 반영치는 본문에 없음)',
    render: () => (
      <ChartBarGrouped
        data={[
          { company: '삼성전자', 기여도: 1 },
          { company: 'SK하이닉스', 기여도: 6.7, 주가반영: 70 },
        ]}
        config={{
          기여도: { label: 'HBM 매출 기여도', color: 'var(--chart-1)' },
          주가반영: { label: '실제 주가 반영', color: 'var(--chart-2)' },
        }}
        xKey="company"
        series={['기여도', '주가반영']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book1-b3-per-normalized',
    title: '삼성전자·SK하이닉스 PER — 현재·정상화·과거 고점',
    description: '지금 PER을 고점 이익 기준(정상화)·과거 고점 당시 실제 PER과 나란히 놓고 비교',
    source:
      '7장 본문 「오르내리는 산업에서는 직전 이익 고점이 기준선이다」 표 — 2023년 PER, 고점 이익 기준 PER, 과거 고점 때 실제 PER (SK하이닉스 2023년은 적자로 PER −15.1배). 삼성전자의 과거 고점 실제 PER은 본문 표기가 "5배 미만"이라 5로 표시(근사치)',
    render: () => (
      <ChartBarGrouped
        data={[
          { stage: '현재(2023년)', 삼성전자: 73, SK하이닉스: -15.1 },
          { stage: '정상화(고점이익 기준)', 삼성전자: 9.3, SK하이닉스: 6 },
          { stage: '과거 고점 실제', 삼성전자: 5, SK하이닉스: 4 },
        ]}
        config={{
          삼성전자: { label: '삼성전자', color: 'var(--chart-1)' },
          SK하이닉스: { label: 'SK하이닉스', color: 'var(--chart-2)' },
        }}
        xKey="stage"
        series={['삼성전자', 'SK하이닉스']}
        valueFormatter={(n) => `${n}배`}
      />
    ),
  },
]);
