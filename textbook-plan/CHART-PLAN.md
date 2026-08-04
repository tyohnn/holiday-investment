# 교재 차트 계획 — chartcn 통합

> 분석일 2026-08-03. 도구: [tyohnn/chartcn](https://github.com/tyohnn/chartcn) shadcn registry (127 items,
> host `https://chartcn-web.vercel.app`).
>
> 에이전트 스킬은 `npx skills add tyohnn/chartcn --skill chartcn`으로 설치한다. 설치 위치인
> `.agents/`는 gitignore 대상이라 저장소에 담기지 않는다(`.claude/skills/chartcn` 심링크만 추적된다).
> 전체 아이템 목록은 `curl -s https://chartcn-web.vercel.app/r/registry.json | jq -r '.items[].name'`.

## 원칙

1. **데이터를 지어내지 않는다.** 모든 차트는 본문 표·문장에 이미 있는 실측 숫자만 쓴다.
   숫자가 아닌 개념 구조는 `개념형`으로 표기하고, 등급(상/중/하)을 점수로 치환하는 경우
   원본 등급을 차트 옆에 병기한다.
2. **표를 그대로 옮기지 않는다.** 차트가 표보다 나은 경우 — 추세, 비율 비교, 분포, 흐름,
   다축 비교, 민감도 — 만 채택한다.
3. **테마 토큰만 쓴다.** `var(--chart-1)` … `var(--chart-5)`. 하드코딩 색 금지.
4. **출처를 붙인다.** 각 차트 하단에 근거가 된 본문 표/절을 캡션으로 남긴다.

## 삽입 방식

교재 원본(`교재/**/*.md`)은 순수 마크다운 SSOT다. `apps/web/scripts/sync-content.mjs`의
`escapeMdx()`가 JSX 태그를 전부 이스케이프하므로 **원본에 JSX를 직접 쓸 수 없다.**
따라서 기존 placeholder 관례를 확장한다.

```markdown
<!-- MEDIA:chart id="book2-a2-cathode-dominance" -->
> **[차트]** 4대 소재 시장규모·원가비중 — 양극재가 나머지 셋을 합친 것과 맞먹는다
```

- 원본 마크다운/깃허브에서는 캡션 인용구로 읽히고, 웹에서는 실제 차트가 렌더된다.
- `sync-content.mjs`가 이 마커를 `<TextbookChart id="…" />`로 변환한다(이스케이프보다 먼저).
- `scripts/교재/placeholder-index.mjs`가 기존 정규식 그대로 집계한다(`MEDIA:chart`).
- 데이터는 `apps/web/components/charts/data/<id>.ts`에 id로 등록하고,
  `TextbookChart`가 id → (차트 컴포넌트 + 데이터 + 캡션)으로 디스패치한다.

## 선행 작업 (foundation)

`apps/web`에는 shadcn이 설치돼 있지 않다(`components.json` 없음, `ui/`에 accordion 하나).
chartcn 아이템은 `registryDependencies: ["card", "chart"]`를 요구한다.

1. `components.json` 생성 (Tailwind 4, `@/` alias, `cn` = `cnfast`)
2. `ui/card.tsx`, `ui/chart.tsx` 설치
3. `app/global.css`에 `--chart-1`…`--chart-5` 및 shadcn 기본 토큰을 Fumadocs
   `--color-fd-*` 팔레트와 맞물리게 light/dark 양쪽 정의
4. `components/mdx.tsx`에 `TextbookChart` 등록
5. `sync-content.mjs`에 `MEDIA:chart` 변환 추가

---

# 1권 — 기업의 가치를 계산하는 법

## 제1부 (A). 투자 철학과 원칙

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| — | A1 투자의 본질 | — | 없음. 야프섬·초인플레는 두 시점뿐이고 나머지는 개념. 기존 `book1-a1-invest-vs-speculate` diagram 유지 | — |
| `book1-a2-margin-ladder` | 삼양식품 — 진입가·현재가·적정주가·실제 저점/고점 | `chart-bar-reference` | A2:87–102,120,122 (219,000 / 195,000 / 585,000 / 170,000 / 718,000원) | 상 |
| `book1-a2-tenbagger-math` | 안정형 vs 십루타형 최종 금액 분해 | `chart-bar-stacked` | A2:146–153 (1.4억 vs 2.6억, 종목별 기여) | 상 |
| `book1-a2-uncovered-universe` | 상장 3,000개 중 커버 300개 | `chart-pie-donut` | A2:179 | 중 |
| `book1-a3-target-price-decay` | 목표주가는 EPS와 배수를 동시에 깎아 무너진다 | `chart-bar-dual-axis` | A3:188 (EPS 5,348→3,820, PER 56→44, 목표가 30만→17만) | 상 |
| `book1-a3-three-forces` | 가치·재료·인식의 되먹임 | `chart-graph-force` | A3:25–29 (개념형) | 중 |
| `book1-a4-taco-bell` | 타코벨 — 87% 하락을 견딘 6년 | `chart-line-basic` | A4:78,84 (14→7→1→42달러) | 상 |
| `book1-a4-ecopro-cycle` | 에코프로 — 15배 급등 뒤 3년 3개월 하락, 3주 반등 | `chart-line-basic` | A4:171 | 중 |

## 제2부 (B). 기업 선정

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book1-b1-industry-sieve` | 산업을 고르는 세 개의 체 | `chart-extras-funnel-template` | B1:87–95 (개념형 + 침투율 8~9%) | 상 |
| `book1-b1-shinyoung-aum` | 신영자산운용 AUM 5,541억→294억 | `chart-bar-basic` | B1:85 | 중 |
| `book1-b2-cathode-margin` | 양극재 3사 영업이익률 4년 추이 | `chart-line-multi` | B2:132–136 | 상 |
| `book1-b2-ramen-margin` | 삼양식품 vs 농심 영업이익률 4년 | `chart-line-multi` | B2:152–156 (9→24% vs 3.5→5.5%) | 상 |
| `book1-b2-tariff-moat` | 품목별 미국 관세율 = 해자 성적표 | `chart-extras-bar-horizontal` | B2:203–208 (0/0/15/50%) | 중 |
| `book1-b3-cell-four-axes` | 배터리 4사 경쟁력 4축 | `chart-radar-multi` | B3:52–58 (개념형, 상/중/하 병기) | 상 |
| `book1-b3-hbm-gap` | HBM 기여도 1%·6.7% vs 주가 반영 +70% | `chart-bar-grouped` | B3:263–268 | 상 |
| `book1-b3-per-normalized` | 삼성전자·SK하이닉스 PER — 현재·정상화·과거 고점 | `chart-bar-grouped` | B3:286–293 | 상 |
| `book1-b4-ipo-makeup` | 빅히트·시프트업 상장 후 궤적 | `chart-line-multi` | B4:235,244 | 상 |
| `book1-b4-individual-edge` | 개인 vs 기관 다섯 축 | `chart-radar-multi` | B4:101–111 (개념형) | 중 |

## 제3부 (C). 정량 밸류에이션 — **차트 밀도 최상**

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book1-c1-per-paradox` | 이익은 늘고 PER은 떨어진다 (현대차 2020–23) | `chart-bar-dual-axis` | C1:231–236 | 상 |
| `book1-c1-peg-scatter` | 성장률 대비 PER — 네이버·카카오·에코프로비엠 | `chart-scatter-basic` | C1:368–371,392–401 | 상 |
| `book1-c1-global-auto-per` | 세계 완성차 PER 순위 | `chart-extras-bar-horizontal` | C1:445 | 중 |
| `book1-c2-scenario-matrix` | **아홉 칸 시나리오 매트릭스 (현대차)** | `chart-analysis-heatmap-correlation` | C2:139–151 (순이익 3 × PER 3, 본문 공식 그대로 산출) | 상 |
| `book1-c2-fair-value-range` | 5개 회사 적정주가 범위 | `chart-extras-bar-range` | C2:197–203 | 상 |
| `book1-c3-lgc-revenue-check` | LG엔솔 매출 실제·추정·회사 목표 교차검증 | `chart-bar-reference` | C3:103–111 | 상 |
| `book1-c3-units-vs-twh` | 대수 1위와 용량 1위가 뒤집힌다 | `chart-bar-dual-axis` | C3:71–77 | 상 |
| `book1-c3-gwh-constant` | GWh당 환산값 보정 추이 | `chart-line-basic` | C3:103–109 | 하 |
| `book1-c4-coupang-psr` | 쿠팡 — 13년 적자에도 매출은 커졌다 | `chart-bar-dual-axis` | C4:55–58 | 상 |
| `book1-c4-psr-bands` | 성장산업별 PSR 정상 밴드 vs 이차전지 | `chart-extras-bar-range` | C4:161 | 상 |
| `book1-c4-semi-psr` | 삼성전자·SK하이닉스 PSR 하락의 서로 다른 이유 | `chart-line-multi` | C4:136–139 | 중 |
| `book1-c5-discount-ladder` | **저평가 사다리 — 층마다 붙는 할인** | `chart-analysis-waterfall` | C5:27–31 (0% / 50% / 60%) | 상 |
| `book1-c5-lgchem-repeat` | LG화학 지분가치 대비 비율·상승여력 4시점 | `chart-line-dual-axis` | C5:105–110 | 상 |
| `book1-c5-pref-spread` | 우선주 괴리율과 40% 기준선 | `chart-bar-reference` | C5:219–225 | 상 |

## 제4부 (D). 정보 소스

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book1-d1-hyundai-kia` | 현대차 vs 기아 3개 지표 | `chart-bar-grouped` | D1:69 | 중 |
| `book1-d1-utilization` | 이차전지 3사 2024 가동률 | `chart-bar-basic` | D1:163 | 하 |
| `book1-d2-semi-share` | 메모리 vs 시스템반도체 국가 점유율 | `chart-bar-stacked-expand` | D2:191 | 상 |
| `book1-d2-ess-region` | 미국 ESS 누적 설치량 지역 비중 | `chart-pie-basic` | D2:120 | 상 |
| `book1-d2-growth-baseline` | 반도체 관련 산업별 성장률 | `chart-extras-bar-horizontal` | D2:176 | 중 |
| `book1-d2-target-follows-price` | 한미반도체 — 목표주가가 주가를 따라간다 | `chart-analysis-slope` | D2:33 | 중 |

## 제5부 (E). 포트폴리오 구성

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book1-e1-buffett-weights` | 버핏 포트폴리오 비중 (상위 5 = 78%) | `chart-treemap-basic` | E1:220 | 상 |
| `book1-e1-asset-200y` | 자산별 200년 실질 수익률 | `chart-extras-bar-diverging` | E1:279 | 상 |
| `book1-e1-holding-range` | 보유 1년 기준 자산별 최고·최저 | `chart-extras-bar-range` | E1:293 | 상 |
| `book1-e1-age-rule` | 100 − 나이 | `chart-line-basic` | E1:31 | 중 |
| `book1-e2-diversification` | **종목 수와 흔들림 (41.7 → 27.4 → 24.4 → 22.6%)** | `chart-bar-basic` | E2:19 | 상 |
| `book1-e2-cap-limits` | 시총 등급별 상한 20/10/5% | `chart-bar-basic` | E2:194 | 하 |
| `book1-e3-cash-backtest` | 에코프로 — 몰빵 vs 현금 20% 유지 | `chart-bar-grouped` | E3:334 | 상 |
| `book1-e3-buffett-indicator` | 버핏지수 밴드 위 미국·한국 위치 | `chart-analysis-bullet` | E3:161 | 상 |
| `book1-e3-margin-debt` | 신용잔고 32조 vs 2021 고점 24조 | `chart-bar-basic` | E3:141 | 하 |

## 제6·7부 + 부록 (F·G)

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book1-f1-bottom3y-top3d` | 바닥 3년 천장 3일 — 하락·상승 기간 비대칭 | `chart-bar-grouped` | F1:17–19 | 상 |
| `book1-f1-walmart` | 143배에서 팔았다면 놓쳤을 2,725배 | `chart-bar-basic` | F1:184 | 중 |
| `book1-f1-switch` | SK이노 → 피엔티 교체 한 달 뒤 | `chart-bar-basic` | F1:81–83,290 | 하 |
| `book1-g1-concentration` | 종목 수와 최선호 종목 비중 | `chart-line-basic` | G1:271 | 상 |
| `book1-g2-account-bridge` | 수익 인증 착시 — 계좌 기여도 브리지 | `chart-analysis-waterfall` | G2:146–148 (+2.4 / −8.0 / −5.6%p) | 상 |
| `book1-g2-compound-58y` | 연 20% vs 연 10%, 58년 후 154배 | `chart-line-multi` | G2:54–56 | 상 |
| `book1-g2-rising-ratio` | 상승장에도 오른 종목은 18% | `chart-pie-donut` | G2:164 | 하 |
| `book1-appendix-compound` | 단리·복리 × 10%/20% — 10·20·30·50년 | `chart-line-multi` | 부록:412–424 | 상 |
| `book1-appendix-drawdowns` | 빚투 금지 근거 — 실제 낙폭 | `chart-extras-bar-horizontal` | 부록:391–398 | 중 |
| `book1-appendix-allowance` | 대학생 용돈 만족도 | `chart-pie-donut` | 부록:159 | 하 |

## 제8부 (H). 실전 케이스 — **차트 밀도 최상**

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book1-h1-margin-reversal` | 현대차·기아 분기 영업이익률 반전 | `chart-line-multi` | H1:270–278 | 상 |
| `book1-h1-per-paradox` | 현대차 PER 하락 vs 영업이익 증가 | `chart-bar-dual-axis` | H1:171–178 | 상 |
| `book1-h1-nine-cell-range` | 현대차·기아 적정주가 범위 | `chart-extras-bar-range` | H1:99–111 | 상 |
| `book1-h1-samyang-vs-nongshim` | 삼양식품 vs 농심 5지표 | `chart-radar-multi` | H1:405–413 | 상 |
| `book1-h2-hybe-collapse` | 하이브 성장률 붕괴 | `chart-line-multi` | H2:187–189 | 상 |
| `book1-h2-bts-share` | 매출의 67%가 BTS | `chart-pie-donut` | H2:69 | 상 |
| `book1-h2-label-mix` | 레이블별 매출·순이익 비중 | `chart-bar-grouped` | H2:101–107 | 중 |
| `book1-h2-lesserafim` | 르세라핌 첫 주 음반 판매 | `chart-bar-basic` | H2:153–155 | 중 |
| `book1-h3-utilization-drop` | 배터리 3사 가동률 하락 | `chart-bar-grouped` | H3:124 | 상 |
| `book1-h3-upside-ranking` | 이차전지 6종목 상승여력 순위 | `chart-extras-bar-horizontal` | H3:240–247 | 상 |
| `book1-h3-europe-share` | 유럽시장 점유율 (중국 내수 제외) | `chart-pie-basic` | H3:110–116 | 중 |
| `book1-h3-cell-four-axes` | 배터리 4사 경쟁력 매트릭스 | `chart-radar-multi` | H3:136–144 (개념형) | 중 |
| `book1-h4-psr-screen` | PSR 스크리닝 (0.08 / 0.28 / 6.6) | `chart-bar-basic` | H4:83–89 | 상 |
| `book1-h4-sammok` | 삼목에스폼 3개년 매출·수익성 | `chart-bar-dual-axis` | H4:132–137 | 상 |
| `book1-h4-els-knockin` | ELS 낙인 종목의 고점–저점 구간 | `chart-extras-bar-range` | H4:497–510 | 상 |
| `book1-h4-sgng-nav` | SG&G 순자산가치 vs 시총 | `chart-analysis-waterfall` | H4:263–271 | 상 |

## 제9부 (I). 증권 기초

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book1-i1-geumyang-overhang` | 금양 오버행 — 희석 물량 6.6% | `chart-pie-donut` | I1:192–204 | 상 |
| `book1-i1-stake-headroom` | 지주사가 팔 수 있는 지분 여력 | `chart-treemap-basic` | I1:297–303 | 중 |
| `book1-i2-holdco-bridge` | **LG화학 지분가치 → 50% 할인 → 실제 시총** | `chart-analysis-waterfall` | I2:199–209 | 상 |
| `book1-i2-pref-spread` | 종목별 보통주–우선주 괴리율 | `chart-extras-bar-horizontal` | I2:97–105 | 상 |
| `book1-i2-posco-parts` | 포스코홀딩스 시총 구성 | `chart-treemap-basic` | I2:254–263 | 상 |
| `book1-i3-three-layers` | 계좌 자산의 보관·보호·신용 3층 | `chart-treemap-grouped` | I3:5,17,73 | 상 |
| `book1-i3-deposit-limits` | 국가별 예금자보호 한도 | `chart-extras-bar-horizontal` | I3:133–140 | 중 |
| `book1-i3-els-asymmetry` | ELS 손익 비대칭 (+5% / −50%) | `chart-extras-bar-diverging` | I3:213–222 | 상 |
| `book1-i4-lnf-transfer` | 엘앤에프 이전상장 전후 주가 경로 | `chart-line-basic` | I4:231–238 | 상 |
| `book1-i4-shortsell-resume` | 공매도 재개 후 코스피 성과 | `chart-bar-grouped` | I4:151–156 | 중 |
| `book1-i5-tariff-incidence` | 배터리 사슬 품목별 관세율 | `chart-bar-basic` | I5:84–89 | 상 |

> **차트로 부적합 판정** — I1 유상증자 3유형(수치 없음), I4 공매도 대차 3단계(절차형).
> 둘 다 플로우 다이어그램이 필요하며 chartcn 범위 밖이다. 기존 `MEDIA:diagram`로 남긴다.

---

# 2권 — 이차전지 산업을 해부하는 법

## 제1부 (A). 과학 원리

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book2-a1-battery-price` | kWh당 $1,000 → $156 | `chart-bar-basic` | A1:116–119 | 상 |
| `book2-a1-tesla-arc` | 테슬라 주가 궤적 + 사건 콜아웃 | `chart-extras-line-reference` | A1:79–88 | 상 |
| `book2-a1-ecopro-cycle` | 에코프로 — 1차 붐·죽음의 계곡·2차 붐 | `chart-line-basic` | A1:228–236 | 중 |
| `book2-a2-cathode-dominance` | **4대 소재 시장규모·원가비중** | `chart-bar-grouped` | A2:89–94 | 상 |
| `book2-a2-cell-share` | 셀 점유율 2024 (중국 내수 제외) | `chart-extras-bar-horizontal` | A2:213–220 | 상 |
| `book2-a2-capa-vs-mcap` | 양극재 4사 캐파 vs 시총 (순위 역전) | `chart-bar-dual-axis` | A2:261–266 | 상 |
| `book2-a3-ncma-vs-lfp` | NCMA 305 vs LFP 165 Wh/kg | `chart-bar-basic` | A3:70–78 | 상 |
| `book2-a3-density-roadmap` | 세대별 에너지밀도 (80→240→300) | `chart-line-dots` | A3:378–383 | 상 |
| `book2-a3-lfp-price-by-region` | LFP가 싼 게 아니라 중국이 싸다 | `chart-bar-grouped` | A3:328–335 | 상 |
| `book2-a3-benz-contract` | 벤츠 25조 계약 NCM 90% | `chart-pie-donut` | A3:355–360 | 중 |
| `book2-a4-particle-scale` | 물질 크기 스케일 (2nm ~ 200μm) | `chart-extras-bar-horizontal` | A4:25–33 | 상 |
| `book2-a4-precursor-capa` | 에코프로머티리얼즈 5만 → 21만 톤 | `chart-bar-basic` | A4:100–107 | 중 |
| `book2-a4-analog-tenure` | 3대 아날로그 기술의 업력 | `chart-extras-bar-horizontal` | A4:156–160 | 중 |

## 제2부 (B). 기술 로드맵

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book2-b1-2170-vs-4680` | 2170 vs 4680 다축 비교 | `chart-radar-multi` | B1:93–98 | 상 |
| `book2-b1-46phi-mapping` | 완성차 → 배터리사 46파이 수주 | `chart-sankey-basic` | B1:139–146 | 상 |
| `book2-b1-cell-count` | 셀 개수 4,300 / 700 / 900 | `chart-extras-bar-horizontal` | B1:19–21,79–82 | 중 |
| `book2-b2-formfactor-share` | 2023 모양별 점유율 | `chart-pie-donut` | B2:50 | 상 |
| `book2-b2-dry-savings` | 건식공정 절감 효과 4항목 | `chart-bar-basic` | B2:98–103 | 상 |
| `book2-b2-drying-cost` | 건조가 잡아먹는 시간 50% | `chart-radial-progress` | B2:107 | 하 |
| `book2-b3-midnickel-reversal` | **NCM613 vs 811 vs 9½½ — 재료비·밀도 역전** | `chart-bar-dual-axis` | B3:74–79 | 상 |
| `book2-b3-nickel-lineage` | 니켈 함량 20년 계보 | `chart-line-basic` | B3:102–108 | 중 |
| `book2-b3-leadtime` | 산업별 개발 리드타임 | `chart-extras-bar-horizontal` | B3:283–287 | 중 |
| `book2-b4-density-roadmap` | 세대별 에너지밀도 (A3와 공유) | `chart-line-dots` | B4:11–16 | 상 |
| `book2-b4-2035-mix` | 2035년에도 리튬이온 87~90% | `chart-pie-donut` | B4:104–108 | 상 |
| `book2-b4-lisulfur-multiple` | 리튬황 — 용량 8배·10배·밀도 1.5배 | `chart-bar-grouped` | B4:124–131 | 상 |
| `book2-b4-li2s-price` | 황화리튬 $12,000 → $50 | `chart-bar-basic` | B4:72–94 | 중 |

## 제3부 (C). 산업사·정책·지정학

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book2-c1-ev-growth` | 전기차 성장률 109% → 16.5% | `chart-bar-basic` | C1:99–105 | 상 |
| `book2-c2-ira-path` | IRA 광물·부품 요건 비율 경로 | `chart-line-multi` | C2:29–37 | 상 |
| `book2-c2-tariff-table` | 품목별 관세 취급 | `chart-extras-bar-horizontal` | C2:219–224 | 중 |
| `book2-c3-byd-breakdown` | BYD 430만 대 중 순수 EV 176만 | `chart-pie-donut` | C3:58–61 | 상 |
| `book2-c3-byd-financials` | BYD 순이익 −32.6% / 차입금 +642% | `chart-extras-bar-diverging` | C3:64–70 | 상 |
| `book2-c3-utilization-cn-kr` | 중국 49.5% vs 한국 3사 60% | `chart-bar-basic` | C3:66 | 중 |
| `book2-c3-ebus-share` | 전기버스 점유율 공식 43.8% vs 실질 70% | `chart-bar-basic` | C3:144–151 | 중 |
| `book2-c4-lithium-cycle` | **탄산리튬 14개 분기 시계열 + 사건 콜아웃** | `chart-extras-line-reference` | C4:104–121 | 상 |
| `book2-c4-utilization-3y` | 배터리 3사 가동률 2023–25 | `chart-bar-grouped` | C4:297–301 | 상 |
| `book2-c4-albemarle-ecopro` | 앨버말 ↔ 에코프로 동행 | `chart-line-dual-axis` | C4:309–325 (부분 정량) | 중 |

## 제4부 (D). 밸류체인 지도

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book2-d1-na-plants` | 북미 합작공장 캐파 (GWh) | `chart-extras-bar-horizontal` | D1:149–157 | 상 |
| `book2-d1-capex-split` | 셀 공장 공정별 투자 비중 | `chart-pie-donut` | D1:26–33 | 상 |
| `book2-d1-leadtime-bridge` | 착공 → 공급 3~3.5년 | `chart-analysis-waterfall` | D1:175–179 | 중 |
| `book2-d2-capa-plan` | 셀 3사 캐파 계획 540/220/150 | `chart-bar-basic` | D2:56–60 | 상 |
| `book2-d2-cell-share` | 2024 셀 점유율 | `chart-pie-basic` | D2:62–64 | 상 |
| `book2-d2-four-axes` | 셀 4사 경쟁력 4요소 채점 | `chart-radar-multi` | D2:204–212 (개념형, 등급 병기) | 상 |
| `book2-d2-mcap` | 셀 4사 + CATL 시총 | `chart-bar-basic` | D2:259–263 | 중 |
| `book2-d3-material-size` | 4대 소재 시장규모·원가비중 | `chart-bar-grouped` | D3:19–25 | 상 |
| `book2-d3-country-share` | **소재별 국가 점유율 — 한국이 이기는 건 양극재뿐** | `chart-bar-grouped` | D3:37–42 | 상 |
| `book2-d3-cathode-capa` | 양극재 4사 캐파 2021→2025 | `chart-bar-grouped` | D3:60–65 | 상 |
| `book2-d3-capa-vs-mcap` | 캐파 순위 vs 시총 순위 어긋남 | `chart-bar-dual-axis` | D3:60–69 | 중 |
| `book2-d4-capex-split` | 공정별 장비 투자 비중 | `chart-pie-donut` | D4:39–44 | 상 |
| `book2-d4-per-screen` | **PER 10배 미만 13종목 스크리닝** | `chart-scatter-bubble` | D4:84–98 | 상 |
| `book2-d4-backlog-multiple` | 수주잔고 ÷ 시총 배수 vs PER | `chart-bar-dual-axis` | D4:114–119 | 상 |
| `book2-d4-wooshin` | 우신시스템 매출·이익률 추이 | `chart-bar-dual-axis` | D4:183–192 | 중 |
| `book2-d5-patent-overlap` | 분야별 중국 특허 침해율 범위 | `chart-extras-bar-range` | D5:49–54 | 상 |

> **생키 부적합** — D1 밸류체인 지도(9–22행)는 단계별 담당·기업만 있고 흐름량이 없다.
> 채찍효과 표(46–52행)도 서열만 있고 크기가 없다. 억지 생키 대신 표를 유지한다.

## 제5부 (E). 기업 분석과 주가 평가

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book2-e1-ecopro-run` | 에코프로 7만 → 150만 원 궤적 | `chart-line-basic` | E1:62–71 | 상 |
| `book2-e1-flow-rotation` | 눌린 종목 vs 기관 보유 종목 6개월 | `chart-bar-grouped` | E1:139 | 중 |
| `book2-e2-penetration` | 국가별 EV 침투율 vs 캐즘선 13.5% | `chart-bar-reference` | E2:63–68 | 상 |
| `book2-e2-utilization` | 셀 3사 가동률 2023→2024 | `chart-bar-grouped` | E2:135 | 상 |
| `book2-e2-lithium-cycle` | 리튬 가격 사이클 3시점 | `chart-line-basic` | E2:145 | 중 |
| `book2-e3-capa-trajectory` | 셀 3사 캐파 2023–2027 | `chart-line-multi` | E3:92–144 | 상 |
| `book2-e3-upside` | 셀 3사 상승여력 +208/+350/+371% | `chart-extras-bar-diverging` | E3:172–177 | 상 |
| `book2-e3-gwh-constant` | GWh당 매출 1,200 / 774 / 800억 | `chart-bar-basic` | E3:48–53 | 중 |
| `book2-e4-upside-ranking` | **6종목 2027 상승여력 순위** | `chart-extras-bar-horizontal` | E4:145–152 | 상 |
| `book2-e4-lgchem-sotp` | LG화학 부분의 합 130.8조 vs 시총 19.4조 | `chart-analysis-waterfall` | E4:134–141 | 상 |
| `book2-e5-p6-revenue` | 삼성SDI 44조 계약 반영 매출 궤적 | `chart-bar-basic` | E5:86 | 상 |
| `book2-e5-share-split` | 셀 3사 점유율 방향이 갈린다 | `chart-extras-bar-diverging` | E5:217 | 중 |

## 제6부 (F). 수요 전망과 시장 데이터

| id | 차트 | chartcn | 데이터 근거 | 우선 |
|---|---|---|---|---|
| `book2-f1-growth-bridge` | **2026 성장 기여도 분해 (유럽 +17.8 / 북미 −2.5 / 아시아 +11.2 = +26.5%)** | `chart-analysis-waterfall` | F1:42–49 | 상 |
| `book2-f1-ev-vs-ess` | EV −1.2조 vs ESS +2.2조 | `chart-extras-bar-diverging` | F1:69–77 | 상 |
| `book2-f1-us-ess-share` | 미국 ESS 점유율 CATL 36.5% | `chart-bar-basic` | F1:116 | 중 |
| `book2-f2-surprise` | 소재 3사 전망 대비 실제 | `chart-bar-grouped` | F2:123–128 | 상 |
| `book2-f2-used-ev` | 신차 −28% vs 중고 +12% | `chart-extras-bar-diverging` | F2:160–166 | 중 |
| `book2-f2-target-assumption` | 성장률 가정 → 목표주가 역추적 | `chart-scatter-trend` | F2:244–249 | 중 |
| `book2-f3-breadth-gauge` | 오른 종목 비율 52 vs 임계 50 | `chart-radial-gauge` | F3:27 | 상 |
| `book2-f3-kospi-kosdaq` | 코스피 +101% vs 코스닥 −1% | `chart-extras-bar-diverging` | F3:23–25 | 상 |
| `book2-f3-china-nmc` | LG엔솔 3.02→11.47% vs CATL 82.5→74.4% | `chart-bar-grouped` | F3:126 | 상 |
| `book2-f3-ess-region` | 1분기 저장장치 지역별 출하 | `chart-bar-basic` | F3:142 | 중 |

---

## 집계

| | 후보 | 우선 상 | 우선 중 | 우선 하 |
|---|---|---|---|---|
| 1권 (32장) | 83 | 55 | 20 | 8 |
| 2권 (26장) | 74 | 49 | 24 | 1 |
| **합계** | **157** | **104** | **44** | **9** |

사용 chartcn 계열: bar(basic/grouped/dual-axis/stacked/reference/stacked-expand),
line(basic/multi/dots/dual-axis), extras(bar-horizontal/bar-range/bar-diverging/
line-reference/funnel-template), pie(basic/donut), radar(multi), treemap(basic/grouped),
scatter(basic/bubble/trend), analysis(waterfall/heatmap-correlation/bullet/slope),
radial(gauge/progress), sankey(basic), graph(force) — 총 30여 종.

## 집필스타일 §7과의 충돌

현행 [`_집필스타일.md`](../교재/_집필스타일.md) §7은 다음을 규정한다.

> `<!-- MEDIA -->` placeholder는 **말로 설명하기 어려운 것**에만. 장당 0~2개.
> **본문에 이미 있는 표를 도표로 또 만들지 않는다.**

이 계획은 두 조항 모두와 충돌한다(장당 최대 4개, 대부분 본문 표 기반).
차트를 넣으려면 §7을 먼저 개정해야 한다 — 제안:

- `MEDIA:diagram`(말로 설명하기 어려운 구조도)과 `MEDIA:chart`(본문 수치의 시각화)를 분리
- chart는 장당 0~4개, **본문 표를 대체하지 않고 병치**한다(표는 그대로 둔다)
- chart의 데이터는 반드시 같은 장 본문에 있는 수치여야 한다
