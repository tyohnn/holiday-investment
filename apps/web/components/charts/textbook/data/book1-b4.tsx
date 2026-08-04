import { ChartLineMulti } from '../../line-multi';
import { ChartRadarMulti } from '../../radar-multi';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-b4-ipo-makeup',
    title: '빅히트·시프트업 — 상장 후 궤적',
    description:
      '공모가 대비 급등한 뒤, 화장이 지워지며 실망 매물에 눌리는 상장주의 전형적 흐름. 시프트업의 "조정 후" 값 4만원은 본문이 "4만원대"라고 쓴 범위 표현을 대표값으로 근사한 것이다',
    source:
      '8장 본문 「새로 상장한 주식 — 화장이 지워진 뒤에 본다」 — 빅히트 공모가 13.5만원→첫날 고점 35.1만원→한 달 뒤 14.2만원, 시프트업 공모가 6만원→상장 초기 9만원→1년여 하락 후 4만원대',
    render: () => (
      <ChartLineMulti
        data={[
          { stage: '공모가', 빅히트: 13.5, 시프트업: 6 },
          { stage: '상장 초기 고점', 빅히트: 35.1, 시프트업: 9 },
          { stage: '조정 후', 빅히트: 14.2, 시프트업: 4 },
        ]}
        config={{
          빅히트: { label: '빅히트', color: 'var(--chart-1)' },
          시프트업: { label: '시프트업', color: 'var(--chart-2)' },
        }}
        xKey="stage"
        series={['빅히트', '시프트업']}
        valueFormatter={(n) => `${n}만원`}
      />
    ),
  },
  {
    id: 'book1-b4-individual-edge',
    title: '개인 투자자 vs 기관 — 다섯 가지 구조적 차이',
    description:
      '본문은 다섯 강점을 등급 없이 서술만 한다. 개인=5·기관=2는 "개인이 구조적으로 우위, 기관은 제도적으로 제약"이라는 방향성만 표현한 임의 점수이며, 축별 차등은 본문에 없다',
    source:
      '8장 본문 「개인이 가진 다섯 가지 구조적 강점」 표 — 자유롭다·정보가 다르다·규정이 없다·시간이 길다·감정 압박이 덜하다',
    render: () => (
      <ChartRadarMulti
        data={[
          { axis: '회사크기 자유', 개인: 5, 기관: 2 },
          { axis: '정보 차별화', 개인: 5, 기관: 2 },
          { axis: '규정 없음', 개인: 5, 기관: 2 },
          { axis: '시간이 김', 개인: 5, 기관: 2 },
          { axis: '감정 압박 적음', 개인: 5, 기관: 2 },
        ]}
        config={{
          개인: { label: '개인', color: 'var(--chart-1)' },
          기관: { label: '기관', color: 'var(--chart-2)' },
        }}
        angleKey="axis"
        series={['개인', '기관']}
      />
    ),
  },
]);
