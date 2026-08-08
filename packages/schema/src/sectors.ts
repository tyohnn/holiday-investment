/**
 * 업종 분류 — 섹터 10개 → 산업 약 55개.
 *
 * ## 왜 KSIC 를 그대로 쓰지 않는가
 *
 * `companies.sector_code` 는 DART `induty_code` = KSIC 다. 행정 분류라서 두 가지 문제가 있다:
 *   1. **깊이가 제각각** — 상장사 2,648개에 고유 코드 528개(3자리 132·4자리 70·5자리 326).
 *      같은 게임업이 `582`·`5821`·`58211`·`58212` 네 갈래로 흩어진다.
 *   2. **시장이 쓰는 경계와 다르다** — 사용자가 "반도체 섹터"라고 말할 때 기대하는 묶음이
 *      KSIC 중분류 `26`(전자부품·컴퓨터·영상·통신장비, 293개사)이 아니다.
 *
 * 그래서 시장에서 통용되는 10섹터 체계(GICS 계열 한국어 명칭)로 접어 준다. 이름은
 * 업계 일반 용어이지 특정 사업자의 분류 데이터를 옮긴 것이 아니다 — WiseFn 의 WICS
 * 코드값·계층 전체를 복제하지는 않는다(라이선스). 경계가 다르면 그건 우리 판단이다.
 *
 * ## 매칭 방식 — longest prefix wins
 *
 * 라우팅 테이블과 같다. 정밀해야 하는 곳만 깊은 접두를 두고 나머지는 얕게 덮는다:
 *   `5821` → 게임        (게임만 떼어낸다)
 *   `582`  → 소프트웨어   (5821 에 안 걸린 나머지)
 *   `58`   → 미디어·출판  (582 에 안 걸린 나머지)
 * 2자리를 전부 채워 두므로 **커버리지는 100%** 다. 미분류로 새는 종목이 없다.
 *
 * 실측 근거(2026-08-07, 상장 2,648개): 3자리 상위 35개 코드가 75%를 덮고 꼬리 62개 코드는
 * 114개사뿐이다. 그래서 상위는 3~4자리로 정밀하게, 꼬리는 2자리로 거칠게 잡는다.
 */

/**
 * 분류 체계 버전. **비교 수치의 재현성이 여기 걸린다.**
 *
 * 산업 경계가 바뀌면 그 산업의 peer 중앙값·순위가 전부 달라진다. 삼성전자를
 * 전자제품에서 반도체로 옮기는 것만으로 두 산업의 이익률 중앙값이 동시에 움직인다.
 * 화면·리포트에 찍힌 비교 수치가 어느 체계에서 나온 것인지 남기지 않으면 과거와
 * 대조가 불가능해진다.
 *
 * 올리는 기준: 산업 신설·삭제, KSIC 접두 매핑 변경, 종목 예외 추가·삭제.
 */
export const SECTOR_TAXONOMY_VERSION = "2026.08.1";

export type SectorId =
  | "energy"
  | "materials"
  | "industrials"
  | "consumer-discretionary"
  | "consumer-staples"
  | "health-care"
  | "financials"
  | "it"
  | "communication"
  | "utilities";

export const SECTORS: Record<SectorId, string> = {
  energy: "에너지",
  materials: "소재",
  industrials: "산업재",
  "consumer-discretionary": "경기관련소비재",
  "consumer-staples": "필수소비재",
  "health-care": "건강관리",
  financials: "금융",
  it: "IT",
  communication: "커뮤니케이션서비스",
  utilities: "유틸리티",
};

export interface IndustryDef {
  name: string;
  sector: SectorId;
}

/** 산업 사전 — 사용자에게 보이는 업종명의 정본. */
export const INDUSTRIES = {
  // 에너지
  "oil-gas": { name: "정유·가스", sector: "energy" },
  mining: { name: "광업", sector: "energy" },

  // 소재
  chemicals: { name: "화학", sector: "materials" },
  "battery-materials": { name: "이차전지 소재", sector: "materials" },
  steel: { name: "철강", sector: "materials" },
  "non-ferrous": { name: "비철금속", sector: "materials" },
  "metal-products": { name: "금속제품", sector: "materials" },
  paper: { name: "제지·목재", sector: "materials" },
  "building-materials": { name: "시멘트·건축자재", sector: "materials" },

  // 산업재
  machinery: { name: "기계", sector: "industrials" },
  "electrical-equipment": { name: "전기장비", sector: "industrials" },
  battery: { name: "이차전지", sector: "industrials" },
  shipbuilding: { name: "조선", sector: "industrials" },
  aerospace: { name: "우주항공·방산", sector: "industrials" },
  construction: { name: "건설", sector: "industrials" },
  engineering: { name: "건축기술·엔지니어링", sector: "industrials" },
  transport: { name: "운송·물류", sector: "industrials" },
  "commercial-services": { name: "사업서비스", sector: "industrials" },
  printing: { name: "인쇄", sector: "industrials" },

  // 경기관련소비재
  auto: { name: "자동차", sector: "consumer-discretionary" },
  "auto-parts": { name: "자동차부품", sector: "consumer-discretionary" },
  "textiles-apparel": { name: "섬유·의류", sector: "consumer-discretionary" },
  "consumer-durables": { name: "가정용품·가구", sector: "consumer-discretionary" },
  cosmetics: { name: "화장품", sector: "consumer-discretionary" },
  retail: { name: "유통", sector: "consumer-discretionary" },
  "trading-companies": { name: "무역", sector: "consumer-discretionary" },
  "hotels-leisure": { name: "호텔·레저", sector: "consumer-discretionary" },
  restaurants: { name: "음식점", sector: "consumer-discretionary" },
  education: { name: "교육", sector: "consumer-discretionary" },

  // 필수소비재
  "food-beverage": { name: "음식료", sector: "consumer-staples" },
  agriculture: { name: "농업·어업", sector: "consumer-staples" },
  tobacco: { name: "담배", sector: "consumer-staples" },
  "household-goods": { name: "생활용품", sector: "consumer-staples" },

  // 건강관리
  pharma: { name: "제약", sector: "health-care" },
  biotech: { name: "바이오·신약", sector: "health-care" },
  "medical-devices": { name: "의료기기", sector: "health-care" },
  "health-services": { name: "의료서비스", sector: "health-care" },

  // 금융
  banks: { name: "은행", sector: "financials" },
  securities: { name: "증권", sector: "financials" },
  insurance: { name: "보험", sector: "financials" },
  "holding-companies": { name: "지주회사", sector: "financials" },
  "consumer-finance": { name: "여신·기타금융", sector: "financials" },
  "real-estate": { name: "부동산", sector: "financials" },

  // IT
  semiconductors: { name: "반도체", sector: "it" },
  "semiconductor-equipment": { name: "반도체장비", sector: "it" },
  display: { name: "디스플레이", sector: "it" },
  "electronic-components": { name: "전자부품", sector: "it" },
  "electronic-products": { name: "전자제품", sector: "it" },
  "precision-instruments": { name: "정밀기기", sector: "it" },
  software: { name: "소프트웨어", sector: "it" },
  "it-services": { name: "IT서비스", sector: "it" },
  internet: { name: "인터넷서비스", sector: "it" },

  // 커뮤니케이션서비스
  game: { name: "게임엔터테인먼트", sector: "communication" },
  media: { name: "미디어·엔터테인먼트", sector: "communication" },
  telecom: { name: "통신서비스", sector: "communication" },
  advertising: { name: "광고", sector: "communication" },
  publishing: { name: "출판", sector: "communication" },

  // 유틸리티
  "electric-utilities": { name: "전기·가스", sector: "utilities" },
  "water-waste": { name: "수도·환경", sector: "utilities" },
} as const satisfies Record<string, IndustryDef>;

export type IndustryId = keyof typeof INDUSTRIES;

/**
 * KSIC 접두 → 산업. **긴 접두가 이긴다.**
 *
 * 2자리를 빠짐없이 채워 두는 것이 계약이다 — 그래야 어떤 코드가 와도 미분류가 없다.
 * 3~5자리는 2자리 묶음이 시장 감각과 어긋나는 곳에만 둔다.
 */
const KSIC_PREFIX_MAP: Record<string, IndustryId> = {
  // ── 01~08 농림어업·광업
  "01": "agriculture",
  "02": "agriculture",
  "03": "agriculture",
  "05": "mining",
  "06": "mining",
  "07": "mining",
  "08": "mining",

  // ── 10~12 음식료
  "10": "food-beverage",
  "11": "food-beverage",
  "12": "tobacco",

  // ── 13~15 섬유·의류
  "13": "textiles-apparel",
  "14": "textiles-apparel",
  "15": "textiles-apparel",

  // ── 16~18 목재·종이·인쇄
  "16": "paper",
  "17": "paper",
  "18": "printing",

  // ── 19~22 정유·화학
  "19": "oil-gas",
  "20": "chemicals",
  // 화장품·세정제는 화학이 아니라 소비재로 읽힌다.
  // 2042 로 잡아야 아모레(20423)와 LG생활건강(20422)이 함께 걸린다.
  "2042": "cosmetics",
  "21": "pharma",
  // 211 기초의약물질·212 의약품은 제약, 213 의료용품은 기기 쪽에 가깝다.
  "213": "medical-devices",
  "22": "chemicals",

  // ── 23~25 비금속·금속
  "23": "building-materials",
  "24": "steel",
  "242": "non-ferrous",
  "243": "non-ferrous",
  "25": "metal-products",

  // ── 26 전자부품·컴퓨터·통신장비 (IT 의 몸통, 세분 필수)
  "26": "electronic-components",
  "261": "semiconductors",
  "262": "electronic-components",
  "2621": "display",
  "263": "electronic-products",
  "264": "electronic-products",
  "265": "electronic-products",
  "266": "precision-instruments",

  // ── 27 의료·정밀·광학
  "27": "precision-instruments",
  "271": "medical-devices",

  // ── 28 전기장비 (282 축전지 = 이차전지 셀·팩)
  "28": "electrical-equipment",
  "282": "battery",

  // ── 29 기계·장비
  "29": "machinery",
  "2929": "semiconductor-equipment",

  // ── 30~34 운송장비·기타 제조
  "30": "auto-parts",
  "301": "auto",
  "31": "shipbuilding",
  "313": "aerospace",
  "32": "consumer-durables",
  "33": "consumer-durables",
  "34": "machinery",

  // ── 35~39 유틸리티·환경
  "35": "electric-utilities",
  "36": "water-waste",
  "37": "water-waste",
  "38": "water-waste",
  "39": "water-waste",

  // ── 41~42 건설
  "41": "construction",
  "42": "construction",

  // ── 45~47 유통
  "45": "retail",
  "46": "retail",
  "468": "trading-companies",
  "47": "retail",

  // ── 49~52 운송
  "49": "transport",
  "50": "transport",
  "51": "transport",
  "52": "transport",

  // ── 55~56 숙박·음식점
  "55": "hotels-leisure",
  "56": "restaurants",

  // ── 58 출판 (5821 게임을 떼어낸다 — 크래프톤·넷마블이 여기다)
  "58": "publishing",
  "582": "software",
  "5821": "game",

  // ── 59~61 미디어·통신
  "59": "media",
  "60": "media",
  "61": "telecom",

  // ── 62~63 IT 서비스·인터넷
  "62": "it-services",
  "63": "internet",

  // ── 64~68 금융·부동산
  "64": "consumer-finance",
  "641": "banks",
  "649": "holding-companies",
  "65": "insurance",
  "66": "consumer-finance",
  "661": "securities",
  "68": "real-estate",

  // ── 70~76 전문·과학·사업서비스
  "70": "biotech",
  "71": "commercial-services",
  "713": "advertising",
  "72": "engineering",
  "73": "commercial-services",
  "74": "commercial-services",
  "75": "commercial-services",
  "76": "commercial-services",

  // ── 84~96 공공·교육·보건·서비스
  "84": "commercial-services",
  "85": "education",
  "86": "health-services",
  "87": "health-services",
  "90": "hotels-leisure",
  "91": "hotels-leisure",
  "94": "commercial-services",
  "95": "commercial-services",
  "96": "household-goods",
};

/**
 * 종목 단위 예외 — KSIC 가 등록상 "주된 사업"을 따르느라 시장 인식과 갈리는 곳.
 *
 * 삼성전자의 KSIC 는 `264`(통신·방송장비 = 휴대폰)라 코드만 보면 전자제품이지만,
 * 시장은 반도체로 본다. 엔씨소프트는 `582` 3자리에 머물러 `5821`(게임)에 안 걸린다.
 * 이런 건 규칙을 비틀어 고칠 수 없고 — 비틀면 애먼 수백 개가 딸려 온다 — 손으로 짚는 게 맞다.
 *
 * **대형주에만 쓴다.** 사용자가 실제로 많이 보는 종목의 오분류가 체감 품질을 좌우하고,
 * 꼬리 종목까지 손보기 시작하면 유지가 불가능해진다. 근거 없이 추가하지 않는다.
 */
const COMPANY_INDUSTRY_OVERRIDES: Record<string, IndustryId> = {
  "005930": "semiconductors", // 삼성전자 — KSIC 264(휴대폰). 매출·이익의 축은 반도체다
  "036570": "game", // 엔씨소프트 — KSIC 582 라 5821(게임)에 안 걸린다
  "068270": "biotech", // 셀트리온 — KSIC 211(기초의약물질)이나 바이오시밀러다
  "207940": "biotech", // 삼성바이오로직스 — 위와 같은 이유, CDMO
  "247540": "battery-materials", // 에코프로비엠 — 양극재. KSIC 는 전지(282)로 잡는다
  "003670": "battery-materials", // 포스코퓨처엠 — 양극재·음극재
  "066970": "battery-materials", // 엘앤에프 — 양극재
  "105560": "banks", // KB금융 — KSIC 64992(지주회사)이나 은행지주다
  "055550": "banks", // 신한지주
  "086790": "banks", // 하나금융지주
  "316140": "banks", // 우리금융지주
  "138040": "banks", // 메리츠금융지주
};

export interface SectorClassification {
  industry: IndustryId;
  industryName: string;
  sector: SectorId;
  sectorName: string;
  /** 실제로 매칭된 KSIC 접두. 종목 예외로 정해졌으면 `null`. */
  matchedPrefix: string | null;
  /** 종목 단위 예외로 분류됐는지 — 화면이 근거를 다르게 적어야 한다. */
  overridden: boolean;
}

function describe(industry: IndustryId, matchedPrefix: string | null): SectorClassification {
  const def = INDUSTRIES[industry];
  return {
    industry,
    industryName: def.name,
    sector: def.sector,
    sectorName: SECTORS[def.sector],
    matchedPrefix,
    overridden: matchedPrefix === null,
  };
}

/**
 * KSIC 코드를 업종으로 접는다. 긴 접두부터 짧은 접두 순으로 찾는다.
 *
 * `stockCode` 를 주면 종목 단위 예외를 먼저 본다 — 넘기지 않아도 동작하지만,
 * 대형주가 어긋난 채 나오므로 화면에서는 항상 함께 넘기는 것을 권한다.
 *
 * 어떤 코드도 2자리에서는 걸리므로 사실상 항상 분류되지만 계약상 null 을 허용한다.
 * KSIC 가 개정돼 새 중분류가 생기면 조용히 오분류되는 것보다 비는 편이 낫다.
 */
export function classifySector(
  sectorCode: string | null | undefined,
  stockCode?: string | null,
): SectorClassification | null {
  if (stockCode) {
    const override = COMPANY_INDUSTRY_OVERRIDES[stockCode];
    if (override) return describe(override, null);
  }
  if (!sectorCode) return null;
  const code = sectorCode.trim();
  for (let len = Math.min(code.length, 5); len >= 2; len--) {
    const industry = KSIC_PREFIX_MAP[code.slice(0, len)];
    if (industry) return describe(industry, code.slice(0, len));
  }
  return null;
}

/** 한 산업에 속하는 KSIC 접두 전부 — peer 조회의 `like` 조건을 만들 때 쓴다. */
export function ksicPrefixesFor(industry: IndustryId): string[] {
  return Object.entries(KSIC_PREFIX_MAP)
    .filter(([, id]) => id === industry)
    .map(([prefix]) => prefix);
}

/**
 * 같은 산업으로 분류되는지 판정한다.
 *
 * peer 조회는 접두 `like` 로 후보를 넓게 긁은 뒤 이 함수로 거른다. 접두만으로는
 * 더 긴 접두에 뺏긴 코드를 걸러낼 수 없기 때문이다 — `582*` 로 긁으면 `5821`(게임)
 * 까지 딸려 오는데, 소프트웨어 peer 에 게임사가 섞이면 이익률 중앙값이 망가진다.
 */
export function isSameIndustry(
  a: { sectorCode?: string | null; stockCode?: string | null },
  b: { sectorCode?: string | null; stockCode?: string | null },
): boolean {
  const ca = classifySector(a.sectorCode, a.stockCode);
  const cb = classifySector(b.sectorCode, b.stockCode);
  return ca !== null && cb !== null && ca.industry === cb.industry;
}

/** 예외로 지정된 종목 코드 — peer 조회가 접두 밖에 있는 종목까지 끌어오려면 필요하다. */
export function stockCodesForIndustry(industry: IndustryId): string[] {
  return Object.entries(COMPANY_INDUSTRY_OVERRIDES)
    .filter(([, id]) => id === industry)
    .map(([stockCode]) => stockCode);
}
