# 교재 차트 작성 가이드 (에이전트용)

기반은 이미 깔려 있다. 너는 **배정받은 장(챕터)의 차트만** 만든다.

## 절대 규칙

1. **데이터를 지어내지 마라.** 차트에 들어가는 모든 숫자는 **그 장 본문에 실제로 있는 값**이어야 한다.
   본문을 열어 눈으로 확인하고 그대로 옮겨라. [`CHART-PLAN.md`](CHART-PLAN.md)에 적힌 수치는 요약이지 정본이 아니다.
   본문과 계획서가 다르면 **본문이 옳다.**
2. 본문에 수치가 없으면 그 차트는 **만들지 말고 건너뛰어라.** 그리고 보고에 이유를 적어라.
   계획서에 있다고 억지로 채우지 마라.
3. 등급(상/중/하)을 점수로 바꿔 쓰는 "개념형" 차트는, 원본 등급을 `description`이나 `source`에 병기해라.
4. 색은 `var(--chart-1)` … `var(--chart-5)`만 쓴다. 하드코딩 hex 금지.
5. `apps/web/components/charts/` 아래의 chartcn 컴포넌트를 **고치지 마라.** 이미 파라미터화돼 있다.
   원하는 표현이 안 나오면 다른 컴포넌트를 고르거나, 그 차트를 건너뛰고 보고해라.

## 파일 두 개만 건드린다

### ① 데이터 모듈 — `apps/web/components/charts/textbook/data/<book>-<chapter>.tsx`
네 장에 해당하는 파일이 이미 stub으로 존재한다(`export {};` 한 줄). 그 내용을 **통째로 교체**한다.
`data/index.ts`는 이미 전부 연결돼 있으니 **건드리지 마라.**

```tsx
import { ChartBarBasic } from '../../bar-basic';
import { registerTextbookCharts } from '../registry';

registerTextbookCharts([
  {
    id: 'book1-e2-diversification',       // 계획서의 id를 그대로. 전역 유일해야 한다
    title: '종목 수와 계좌 흔들림',
    description: '종목 수를 늘릴수록 전체 흔들림(변동성)이 줄어드는 정도',
    source: '17장 본문 「5~10개가 분산 효과와 집중의 균형점이다」 표',
    render: () => (
      <ChartBarBasic
        data={[
          { count: '1종목', volatility: 41.7 },
          { count: '5종목', volatility: 27.4 },
        ]}
        config={{ volatility: { label: '전체 흔들림', color: 'var(--chart-1)' } }}
        xKey="count"
        dataKey="volatility"
        valueFormatter={(n) => `${n}%`}
      />
    ),
  },
]);
```

- `title` 한국어, 명사구. `description`은 한 줄로 차트가 말하는 바.
- `source`는 **몇 장 어느 절/표**인지 특정한다. 독자가 원문으로 돌아갈 수 있어야 한다.
- `config`의 key는 데이터 객체의 필드명과 같아야 한다 — 컴포넌트가 `var(--color-<key>)`로 색을 찾는다.

### ② 교재 원본 — `교재/<책폴더>/<파일>.md`
근거가 된 표/문단 **바로 아래**에 마커 두 줄을 넣는다. 다른 본문은 **한 글자도 고치지 마라.**

```markdown
<!-- MEDIA:chart id="book1-e2-diversification" -->
> **[차트]** 종목 수와 계좌 흔들림 — 1종목 41.7% → 5종목 27.4% → 10종목 24.4%
```

- 형식이 정확해야 파이프라인이 인식한다(`scripts/교재/placeholder-index.mjs`, `apps/web/scripts/sync-content.mjs`).
- 캡션은 차트가 보여주는 핵심을 한 줄로. 마크다운으로만 볼 독자도 뭘 놓쳤는지 알 수 있게.
- **본문 표를 지우지 마라.** 표는 그대로 두고 차트를 병치한다(정확한 숫자는 표, 패턴은 차트).
  규정은 [`교재/_집필스타일.md`](../교재/_집필스타일.md) §7.

## 컴포넌트 계약

전부 `apps/web/components/charts/` 아래. 모든 prop은 optional(기본값은 영문 데모 데이터)이므로
**필요한 걸 전부 명시적으로 넘겨라.** 안 넘기면 영어 데모 데이터가 그대로 렌더된다.

```tsx
// 단일 계열
ChartBarBasic   { data, config, xKey, dataKey, valueFormatter }
ChartLineBasic  { data, config, xKey, dataKey, valueFormatter }
ChartLineDots   { data, config, xKey, dataKey, valueFormatter }

// 다계열 (series = 데이터 필드명 배열, config에 같은 key가 있어야 색이 붙는다)
ChartBarGrouped       { data, config, xKey, series, valueFormatter }
ChartBarStacked       { data, config, xKey, series, valueFormatter }
ChartBarStackedExpand { data, config, xKey, series, valueFormatter }   // 100% 누적
ChartLineMulti        { data, config, xKey, series, valueFormatter }
ChartSlope            { data, config, xKey, series, valueFormatter }   // 2시점 기울기 비교

// 이중축 (단위가 다른 두 지표)
ChartBarDualAxis  { data, config, xKey, barKey, lineKey, barValueFormatter, lineValueFormatter }
ChartLineDualAxis { data, config, xKey, leftKey, rightKey, leftValueFormatter, rightValueFormatter }

// 기준선·주석
ChartBarReference  { data, config, xKey, dataKey, goalValue, goalLabel, valueFormatter }
ChartLineReference { data, config, xKey, dataKey, domain,
                     target?: {value,label}|null,
                     highlight?: {x1,x2}|null,      // 구간 음영
                     eventDot?: {x,y,label}|null,   // 단일 지점 콜아웃
                     valueFormatter }

// extras
ChartBarHorizontal { data, config, categoryKey, dataKey, categoryWidth, valueFormatter }
                     // ★ 한글 라벨이 길면 이걸 써라. categoryWidth를 라벨 길이에 맞춰 넉넉히
ChartBarDiverging  { data, config, xKey, dataKey, domain: [min,max], valueFormatter }   // 0 기준 ±
ChartBarRange      { data, config, xKey, dataKey, domain, valueFormatter: (r:[number,number])=>string }
                     // 데이터 필드가 [min,max] 튜플: { day:'…', range:[18,42] as [number,number] }
ChartFunnelTemplate { data: {step,value}[], config }

// 비중
ChartPieBasic  { data, config, dataKey, nameKey }
ChartPieDonut  { data, config, dataKey, nameKey, innerRadius }
ChartTreemapBasic   { data: {name, children:{name,size,fill?}[]}[], config }
ChartTreemapGrouped { data: TreemapNode[], config }

// 다축·관계
ChartRadarMulti   { data, config, angleKey, series }
ChartScatterBasic { data, config, xKey, yKey, seriesKey, xValueFormatter, yValueFormatter }
ChartScatterBubble{ data, config, xKey, yKey, zKey, nameKey, seriesKey, zRange }
ChartScatterTrend { data: {x,y}[], config, xDomain, yDomain }          // OLS 추세선 자동
ChartSankeyBasic  { data: {nodes,links}, config }

// analysis
ChartWaterfall { steps: {step,delta,total?}[], config, valueFormatter }
                 // delta는 누적 대비 증감. total:true면 0부터 그린 합계 막대
ChartBullet    { data: BulletRow[], config, valueFormatter }           // 실적 vs 목표 vs 구간
ChartHeatmapCorrelation { labels: string[], matrix: number[][] }        // 정사각 행렬

// radial
ChartRadialGauge    { score, max, config, unitLabel }
ChartRadialProgress { progress, config, label }
```

import 경로: `../../bar-basic`, `../../extras/bar-horizontal`, `../../analysis/waterfall` 처럼
파일 위치를 그대로. 배럴 `../../index`도 있다.

## 한국어에서 자주 걸리는 것

- **X축 라벨 겹침** — 세로 막대에서 한글 카테고리가 4개를 넘거나 라벨이 5자를 넘으면
  `ChartBarHorizontal`로 바꿔라. 억지로 세로 막대를 쓰지 마라.
- **단위** — `valueFormatter`로 붙인다. `(n) => `${n}%``, `(n) => `${n}조 원``, `(n) => `${n.toLocaleString()}원``.
  축 숫자에 단위가 없으면 무슨 값인지 알 수 없다.
- **큰 수** — 조·억 단위로 미리 환산해서 넣어라. 원 단위 raw 값을 그대로 넣으면 축이 못 읽힌다.
  환산했으면 `description`이나 `valueFormatter`에 단위를 명시.
- **음수** — 영업이익률 적자 같은 값은 `ChartBarDiverging`의 `domain`을 실제 최소·최대에 맞춰 넓혀라.

## 끝내기 전에

1. `pnpm types:check` (저장소 루트) — 통과해야 한다.
2. `cd apps/web && pnpm sync` 후 네 장의 `content/docs/<book>/<CH>.mdx`에
   `<TextbookChart id="…" />`가 들어갔는지 확인.
3. 보고: 만든 차트 id 목록 / 건너뛴 것과 이유 / 계획서와 본문이 달랐던 곳.
