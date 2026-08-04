import { ChartBarBasic } from '../../bar-basic';
import { ChartPieDonut } from '../../pie-donut';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-b2-formfactor-share',
    title: '2023년 모양별 점유율',
    description: '각형이 63.6%로 가장 크지만, 이는 중국 내수 비중 때문이다',
    source:
      '6장 본문 「2023년 모양별 점유율은 파우치 20.8퍼센트, 각형 63.6퍼센트, 원통형 15.6퍼센트다」 문단',
    render: () => (
      <ChartPieDonut
        data={[
          { shape: '각형', share: 63.6 },
          { shape: '파우치', share: 20.8 },
          { shape: '원통형', share: 15.6 },
        ]}
        config={{
          share: { label: '점유율' },
          각형: { label: '각형', color: 'var(--chart-1)' },
          파우치: { label: '파우치', color: 'var(--chart-2)' },
          원통형: { label: '원통형', color: 'var(--chart-3)' },
        }}
        dataKey="share"
        nameKey="shape"
      />
    ),
  },
  {
    id: 'book2-b2-dry-savings',
    title: '마른 방식(건식공정) 절감 효과',
    description:
      '용매와 건조 공정을 없애면 전력·설비면적·부품비·제조비용이 함께 줄어든다. 제조비용은 본문이 17~30퍼센트 범위로 제시해 중앙값(23.5%)으로 표시했다. 네 항목의 성격이 균일하지 않다는 점에 주의해야 한다 — "건조설비 면적" 50%는 비용이 아니라 물리적 면적 감소율이고, "제조비용" 17~30%가 전력·부품비 절감을 포함한 합산치인지 별개의 항목인지는 본문에 명시돼 있지 않다',
    source:
      '6장 본문 표 「효과」(전력 30퍼센트 절감, 제조비용 17~30퍼센트 절감)와 「마른 방식으로 바꾸면 에너지 비용 약 30퍼센트, 건조 설비 면적 약 50퍼센트, 부품 비용 약 20퍼센트가 절감된다」 문단',
    render: () => (
      <ChartBarBasic
        data={[
          { item: '전력', savings: 30 },
          { item: '제조비용', savings: 23.5 },
          { item: '건조설비 면적', savings: 50 },
          { item: '부품비용', savings: 20 },
        ]}
        config={{ savings: { label: '절감률', color: 'var(--chart-1)' } }}
        xKey="item"
        dataKey="savings"
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
