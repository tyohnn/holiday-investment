import { ChartBarGrouped } from '../../bar-grouped';
import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { ChartPieBasic } from '../../pie-basic';
import { ChartRadarMulti } from '../../radar-multi';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-h3-utilization-drop',
    title: '배터리 3사 가동률 하락',
    description: '2023년에서 2024년 사이 공장 가동률이 세 회사 모두 크게 떨어졌다 — 적자의 원인이 기술이 아니라 가동률임을 보여 준다',
    source: '24장 본문 「지금의 적자는 기술보다 가동률에서 왔다」',
    render: () => (
      <ChartBarGrouped
        data={[
          { company: 'LG엔솔', y2023: 69.3, y2024: 57.8 },
          { company: '삼성SDI', y2023: 76, y2024: 58 },
          { company: 'SK온', y2023: 87.7, y2024: 43.8 },
        ]}
        config={{
          y2023: { label: '2023년', color: 'var(--chart-1)' },
          y2024: { label: '2024년', color: 'var(--chart-5)' },
        }}
        xKey="company"
        series={['y2023', 'y2024']}
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
  {
    id: 'book1-h3-upside-ranking',
    title: '이차전지 6종목 상승여력 순위',
    description:
      '2027년 적정주가 기준 상승 여력 순위. 상승 여력이 큰 것이 회사가 더 좋다는 뜻은 아니다 — LG화학 1위는 지주회사 할인이 겹쳤기 때문이고, LG엔솔 꼴찌는 실력 1위임에도 이미 가치가 가격에 반영돼서다',
    source: '24장 본문 「여섯 종목을 종합하면 이렇다」 표',
    render: () => (
      <ChartBarHorizontal
        data={[
          { stock: 'LG화학', upside: 514 },
          { stock: '에코프로비엠', upside: 370 },
          { stock: '삼성SDI', upside: 277 },
          { stock: '포스코퓨처엠', upside: 254 },
          { stock: 'SK이노베이션', upside: 253 },
          { stock: 'LG엔솔', upside: 141 },
        ]}
        config={{ upside: { label: '상승 여력', color: 'var(--chart-1)' } }}
        categoryKey="stock"
        dataKey="upside"
        categoryWidth={88}
        valueFormatter={(n) => `+${n}%`}
      />
    ),
  },
  {
    id: 'book1-h3-europe-share',
    title: '세계 배터리 점유율(중국 내수 제외)',
    description:
      '계획서 제목은 "유럽시장 점유율"이지만 본문 수치는 중국 자국 내수(침투율 약 60%)를 뺀 세계 시장 점유율이다 — 본문이 옳으므로 이를 따랐다. 중국을 빼면 CATL과 LG에너지솔루션이 사실상 양강이고 BYD는 4.0%에 불과하다. "기타" 43.9%는 본문에 직접 나오는 값이 아니라 100%에서 CATL(26.3%)·LG에너지솔루션(25.8%)·BYD(4.0%)를 뺀 파생값이다',
    source: '24장 본문 「중국의 우위는 내수를 빼면 달라진다」',
    render: () => (
      <ChartPieBasic
        data={[
          { company: 'catl', share: 26.3 },
          { company: 'lgensol', share: 25.8 },
          { company: 'byd', share: 4.0 },
          { company: 'others', share: 43.9 },
        ]}
        config={{
          share: { label: '점유율' },
          catl: { label: 'CATL', color: 'var(--chart-3)' },
          lgensol: { label: 'LG에너지솔루션', color: 'var(--chart-1)' },
          byd: { label: 'BYD', color: 'var(--chart-5)' },
          others: { label: '기타', color: 'var(--chart-4)' },
        }}
        dataKey="share"
        nameKey="company"
      />
    ),
  },
  {
    id: 'book1-h3-cell-four-axes',
    title: '배터리 4사 경쟁력 매트릭스',
    description:
      '개념형 차트. 본문의 상/중/하 등급을 점수(상=3, 중=2, 하=1)로 바꿔 그렸다. 원래 등급 — 규모(LG상·삼성중·SK중·금양하), 수율(LG상·삼성상·SK중·금양중), 제품종류(LG상 3종·삼성중 2종·SK하 1종·금양하 1종), 원료부터(LG중·삼성하·SK하·금양상)',
    source: '24장 본문 「배터리 4사의 실력은 네 축으로 갈린다」 표(개념형)',
    render: () => (
      <ChartRadarMulti
        data={[
          { axis: '규모', lgensol: 3, samsungsdi: 2, skon: 2, geumyang: 1 },
          { axis: '수율', lgensol: 3, samsungsdi: 3, skon: 2, geumyang: 2 },
          { axis: '제품 종류', lgensol: 3, samsungsdi: 2, skon: 1, geumyang: 1 },
          { axis: '원료부터', lgensol: 2, samsungsdi: 1, skon: 1, geumyang: 3 },
        ]}
        config={{
          lgensol: { label: 'LG엔솔', color: 'var(--chart-1)' },
          samsungsdi: { label: '삼성SDI', color: 'var(--chart-2)' },
          skon: { label: 'SK온', color: 'var(--chart-3)' },
          geumyang: { label: '금양', color: 'var(--chart-4)' },
        }}
        angleKey="axis"
        series={['lgensol', 'samsungsdi', 'skon', 'geumyang']}
      />
    ),
  },
]);
