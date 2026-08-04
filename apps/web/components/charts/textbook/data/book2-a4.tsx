import { ChartBarBasic } from '../../bar-basic';
import { ChartBarHorizontal } from '../../extras/bar-horizontal';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book2-a4-particle-scale',
    title: '물질 크기 스케일 — 반도체부터 모래까지',
    description:
      '반도체 공정(2~3nm)에서 가는 모래(20~200μm, 중앙값 사용)까지 약 4만 4천 배 차이가 난다. 로그 스케일이 아닌 실제 배율이라 선형 축에서는 나노미터 단위 값이 거의 보이지 않는다 — 그래서 각 막대의 실제 값을 카테고리 라벨에 직접 표기했다. 단위는 나노미터로 통일했고(1마이크로미터 = 1,000나노미터), 범위로 제시된 값(반도체 2~3나노미터, 가는 모래 20~200마이크로미터)은 중앙값을 썼다',
    source:
      '4장 본문 「가루를 다루는 기술」 표 — 반도체 공정 2~3나노미터, 양극재 입자 1~10마이크로미터(보통 5), 적혈구 약 8마이크로미터, 구름·안개 입자 약 30마이크로미터, 머리카락 약 100마이크로미터, 가는 모래 20~200마이크로미터',
    render: () => (
      <ChartBarHorizontal
        data={[
          { object: '반도체 공정 (2~3nm)', size: 2.5 },
          { object: '양극재 입자 (5μm)', size: 5000 },
          { object: '적혈구 (8μm)', size: 8000 },
          { object: '구름·안개 입자 (30μm)', size: 30000 },
          { object: '머리카락 (100μm)', size: 100000 },
          { object: '가는 모래 (20~200μm)', size: 110000 },
        ]}
        config={{ size: { label: '크기(나노미터)', color: 'var(--chart-1)' } }}
        categoryKey="object"
        dataKey="size"
        categoryWidth={170}
        valueFormatter={(n) => `${n.toLocaleString()}nm`}
      />
    ),
  },
  {
    id: 'book2-a4-precursor-capa',
    title: '에코프로머티리얼즈 전구체 생산능력 — 5만 → 21만 톤',
    description:
      '4년 만에 약 4.2배로 늘어나는 계획이며, 2027년에는 중국계를 제외하면 세계 하이니켈 전구체 1위가 된다',
    source:
      '4장 본문 「니켈이 많을수록 어렵다」 표 — 현재 생산능력 약 5만 톤/년, 2027년 목표 21만 톤/년(약 4.2배)',
    render: () => (
      <ChartBarBasic
        data={[
          { stage: '현재', capa: 5 },
          { stage: '2027년 목표', capa: 21 },
        ]}
        config={{ capa: { label: '생산능력(만톤/년)', color: 'var(--chart-1)' } }}
        xKey="stage"
        dataKey="capa"
        valueFormatter={(n) => `${n}만톤`}
      />
    ),
  },
  {
    id: 'book2-a4-analog-tenure',
    title: '3대 아날로그 기술의 업력 (2024년 기준)',
    description:
      '시작 연도(불량률 1995년, 굽기 2005년, 리튬 2009년)에서 2024년까지 경과한 연수다. 기준연도 2024년은 본문 핵심 요약의 「포스코·에코프로 2009~2024, 15년」 표기에서 확인했다',
    source:
      '4장 본문 「이차전지의 3대 아날로그 기술」 표(LG에너지솔루션 1995년~, 에코프로비엠 2005년~, 포스코홀딩스·에코프로 2009년~) + 핵심 요약 「포스코·에코프로 2009~2024, 15년」',
    render: () => (
      <ChartBarHorizontal
        data={[
          { tech: '불량률 잡기(LG에너지솔루션)', years: 29 },
          { tech: '굽기(에코프로비엠)', years: 19 },
          { tech: '소금호수 리튬(포스코·에코프로)', years: 15 },
        ]}
        config={{ years: { label: '업력(년)', color: 'var(--chart-1)' } }}
        categoryKey="tech"
        dataKey="years"
        categoryWidth={190}
        valueFormatter={(n) => `${n}년`}
      />
    ),
  },
]);
