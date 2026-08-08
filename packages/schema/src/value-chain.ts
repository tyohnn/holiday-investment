/**
 * 밸류체인 테마 — 분류의 두 번째 축.
 *
 * ## 업종(sectors.ts)과 무엇이 다른가
 *
 * | | 업종 | 밸류체인 |
 * | --- | --- | --- |
 * | 만드는 법 | KSIC 를 접는 기계적 변환 | **손으로 쓰는 판단** |
 * | 커버리지 | 전 종목 100% | 테마에 속한 종목만 |
 * | 배타성 | 한 종목 = 한 산업 | **중복 허용** |
 *
 * ## 왜 자동화할 수 없는가 (2026-08-07 실측)
 *
 * KSIC 로는 양방향으로 깨진다:
 *   - `28202` 한 코드에 셀(삼성SDI·LG에너지솔루션)·양극재(엘앤에프·에코프로비엠)·
 *     분리막(더블유씨피)이 **함께** 들어 있다.
 *   - 같은 동박인데 SKC 는 `204`(화학), 롯데에너지머티리얼즈는 `2629`(전자부품)로 **갈린다**.
 *
 * 사업부문(`report_items.직원.fo_bbm`)도 못 쓴다 — 6개사 확인 결과 "전체"·"공통"·
 * 회사명(SKC)·직무명(관리·연구·제조)이 대부분이고 제품을 가리키는 값은 2개뿐이었다.
 * 사업부문별 매출은 DB 에 항목 자체가 없고 공시 본문(`filing_sections`)은 원격 0행이다.
 *
 * 그래서 **손으로 쓴다.** 이 저장소가 이미 택한 방식이다 —
 * `apps/web/lib/industry/catalog.ts`: "산업 경계는 수집되는 사실이 아니라 감독의 판단이다.
 * 손으로 쓴 판단은 손으로 쓴 파일에 있어야 리뷰가 되고, git 이 변경 이력을 담는다."
 *
 * ## 방향을 뒤집는다
 *
 * 종목 2,648개를 각각 분류하는 건 불가능하다. 카테고리에서 출발해 소속 종목을 적는다 —
 * 테마당 30~80개면 끝난다.
 */

/**
 * 분류 체계 버전. **비교 수치의 재현성이 여기 걸린다.**
 *
 * 소속이 바뀌면 그 테마의 집계(매출 합계·중앙값·순위)가 전부 달라진다. 화면에 찍힌
 * 숫자가 어느 체계에서 나온 것인지 남기지 않으면 과거 리포트와 대조가 불가능해진다.
 * 종목 편입·제외, 상세 카테고리 신설·삭제는 마이너를 올린다.
 */
export const VALUE_CHAIN_TAXONOMY_VERSION = "2026.08.1";

export interface ValueChainDetail {
  id: string;
  /** 사용자에게 보이는 이름 — "양극재" */
  name: string;
  /** 이 단계가 체인에서 하는 일 한 줄 */
  note?: string;
}

export interface ValueChainStage {
  id: string;
  name: string;
  /** 상류 → 하류 순서. 화면이 흐름으로 그린다. */
  order: number;
  details: ValueChainDetail[];
}

export interface ValueChainCategory {
  id: string;
  name: string;
  tagline: string;
  stages: ValueChainStage[];
}

/**
 * 종목의 테마 편입.
 *
 * `evidence` 는 장식이 아니라 **계약**이다. POL-001 이 "편입은 매출 비중·수주·CAPEX 같은
 * 실증 지표로 확인한다. 테마주라는 이유로 넣지 않는다"로 못박았고, 근거 없는 행이 쌓이기
 * 시작하면 이 축 전체의 신뢰가 무너진다.
 */
export interface ValueChainMembership {
  stockCode: string;
  /** `ValueChainDetail.id` */
  detailId: string;
  /** 왜 여기 넣었는가 — 출처가 되는 사실 */
  evidence: string;
  /** 근거의 기준 시점 (YYYY-MM) */
  asOf: string;
  /** 이 사업이 회사 매출에서 차지하는 비중. 확인 못 했으면 생략한다. */
  revenueShare?: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 카테고리 정의
 *
 * MVP 는 전기차·배터리 하나만 완결한다. 44개 테마 × 30~80개사를 한 번에 하는 건
 * 불가능하고, 하나를 끝내면 나머지의 형태가 정해진다.
 * 나머지 테마 목록은 노션 POL-001 에 대분류만 적혀 있다.
 * ──────────────────────────────────────────────────────────────────────────── */

export const VALUE_CHAINS: ValueChainCategory[] = [
  {
    id: "ev-battery",
    name: "전기차·배터리",
    tagline: "광물에서 완성차까지 — 같은 뉴스가 단계마다 다른 의미를 갖는다",
    stages: [
      {
        id: "ev-minerals",
        name: "광물·원자재",
        order: 1,
        details: [
          { id: "ev-lithium", name: "리튬" },
          { id: "ev-nickel", name: "니켈·코발트" },
          { id: "ev-graphite", name: "흑연" },
        ],
      },
      {
        id: "ev-materials",
        name: "소재",
        order: 2,
        details: [
          { id: "ev-cathode", name: "양극재", note: "셀 원가의 최대 비중" },
          { id: "ev-anode", name: "음극재" },
          { id: "ev-separator", name: "분리막" },
          { id: "ev-electrolyte", name: "전해액·전해질" },
          { id: "ev-precursor", name: "전구체" },
          { id: "ev-foil", name: "동박·알루미늄박" },
        ],
      },
      {
        id: "ev-cell",
        name: "셀·팩",
        order: 3,
        details: [
          { id: "ev-cell-maker", name: "셀 제조" },
          { id: "ev-module-pack", name: "모듈·팩" },
          { id: "ev-bms", name: "BMS" },
        ],
      },
      {
        id: "ev-equipment",
        name: "장비",
        order: 4,
        details: [
          { id: "ev-eq-electrode", name: "전극공정 장비" },
          { id: "ev-eq-assembly", name: "조립공정 장비" },
          { id: "ev-eq-formation", name: "화성공정 장비" },
          { id: "ev-eq-inspection", name: "검사 장비" },
        ],
      },
      {
        id: "ev-driveline",
        name: "구동부품",
        order: 5,
        details: [
          { id: "ev-motor", name: "구동모터" },
          { id: "ev-inverter", name: "인버터·전력반도체" },
          { id: "ev-reducer", name: "감속기" },
          { id: "ev-thermal", name: "열관리" },
        ],
      },
      {
        id: "ev-oem",
        name: "완성차",
        order: 6,
        details: [{ id: "ev-oem-maker", name: "전기차 OEM" }],
      },
      {
        id: "ev-infra",
        name: "충전 인프라",
        order: 7,
        details: [
          { id: "ev-charger", name: "충전기 제조" },
          { id: "ev-charging-ops", name: "충전 운영" },
        ],
      },
      {
        id: "ev-circular",
        name: "순환",
        order: 8,
        details: [{ id: "ev-recycling", name: "폐배터리 재활용" }],
      },
    ],
  },
];

/**
 * 종목 편입 — **손으로 쓴다.**
 *
 * 아래는 구조 검증을 위한 시드다. 각 행의 KSIC 는 2026-08-07 에 DB 에서 직접 확인했고,
 * 그 코드들이 밸류체인 단계와 어떻게 어긋나는지가 이 파일 상단 주석의 근거다.
 * `evidence` 는 아직 "확인 필요"인 것이 많다 — 채우기 전에는 화면에 비중을 쓰지 않는다.
 */
export const VALUE_CHAIN_MEMBERSHIPS: ValueChainMembership[] = [
  // 소재 — KSIC 로는 28202·204·2629 로 흩어진다
  { stockCode: "247540", detailId: "ev-cathode", evidence: "양극재 전업 (KSIC 28202)", asOf: "2026-08" },
  { stockCode: "066970", detailId: "ev-cathode", evidence: "양극재 전업 (KSIC 28202)", asOf: "2026-08" },
  // 한 종목이 여러 상세에 속하는 경우 — 이 축이 중복을 허용하는 이유
  { stockCode: "003670", detailId: "ev-cathode", evidence: "양극재·음극재 병행 (KSIC 282)", asOf: "2026-08" },
  { stockCode: "003670", detailId: "ev-anode", evidence: "국내 유일 흑연계 음극재 양산", asOf: "2026-08" },
  { stockCode: "078600", detailId: "ev-anode", evidence: "실리콘 음극재 (KSIC 2629)", asOf: "2026-08" },
  { stockCode: "393890", detailId: "ev-separator", evidence: "분리막 전업 (KSIC 28202)", asOf: "2026-08" },
  { stockCode: "361610", detailId: "ev-separator", evidence: "분리막 (KSIC 282)", asOf: "2026-08" },
  { stockCode: "348370", detailId: "ev-electrolyte", evidence: "전해액 (KSIC 20119)", asOf: "2026-08" },
  { stockCode: "278280", detailId: "ev-electrolyte", evidence: "전해질 첨가제 (KSIC 201)", asOf: "2026-08" },
  // 같은 동박인데 KSIC 가 204 와 2629 로 갈린다 — 자동 분류가 불가능한 직접 증거
  { stockCode: "011790", detailId: "ev-foil", evidence: "동박 (KSIC 204)", asOf: "2026-08" },
  { stockCode: "020150", detailId: "ev-foil", evidence: "동박 (KSIC 2629)", asOf: "2026-08" },

  // 셀 — 소재와 같은 KSIC 28202 를 쓴다
  { stockCode: "006400", detailId: "ev-cell-maker", evidence: "각형·원통형 셀 (KSIC 28202)", asOf: "2026-08" },
  { stockCode: "373220", detailId: "ev-cell-maker", evidence: "파우치·원통형 셀 (KSIC 28202)", asOf: "2026-08" },
];

/* ── 조회 헬퍼 ───────────────────────────────────────────────────────────── */

const DETAIL_INDEX: Map<string, { category: ValueChainCategory; stage: ValueChainStage; detail: ValueChainDetail }> =
  new Map();
for (const category of VALUE_CHAINS) {
  for (const stage of category.stages) {
    for (const detail of stage.details) {
      DETAIL_INDEX.set(detail.id, { category, stage, detail });
    }
  }
}

export interface ValueChainPlacement {
  category: ValueChainCategory;
  stage: ValueChainStage;
  detail: ValueChainDetail;
  membership: ValueChainMembership;
}

/** 이 종목이 어느 밸류체인 어느 단계에 있는가. 없으면 빈 배열 — 대부분의 종목이 그렇다. */
export function placementsForStock(stockCode: string | null | undefined): ValueChainPlacement[] {
  if (!stockCode) return [];
  const out: ValueChainPlacement[] = [];
  for (const membership of VALUE_CHAIN_MEMBERSHIPS) {
    if (membership.stockCode !== stockCode) continue;
    const found = DETAIL_INDEX.get(membership.detailId);
    // 매핑이 가리키는 상세가 사라졌으면 조용히 버리지 않고 드러낸다.
    if (!found) throw new Error(`알 수 없는 밸류체인 상세: ${membership.detailId}`);
    out.push({ ...found, membership });
  }
  return out;
}

/** 한 상세 카테고리에 속한 종목코드 — peer 비교나 목록에 쓴다. */
export function stockCodesInDetail(detailId: string): string[] {
  return VALUE_CHAIN_MEMBERSHIPS.filter((m) => m.detailId === detailId).map((m) => m.stockCode);
}

/** 한 카테고리(테마) 전체에 속한 종목코드 — 중복 제거. */
export function stockCodesInCategory(categoryId: string): string[] {
  const category = VALUE_CHAINS.find((c) => c.id === categoryId);
  if (!category) return [];
  const detailIds = new Set(category.stages.flatMap((s) => s.details.map((d) => d.id)));
  return [...new Set(VALUE_CHAIN_MEMBERSHIPS.filter((m) => detailIds.has(m.detailId)).map((m) => m.stockCode))];
}

export function getValueChain(categoryId: string): ValueChainCategory | undefined {
  return VALUE_CHAINS.find((c) => c.id === categoryId);
}
