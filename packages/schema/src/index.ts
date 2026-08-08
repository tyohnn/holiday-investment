/**
 * 플랫폼 데이터 계약 — DB 행의 런타임 타입.
 *
 * 역할 분담:
 *   - 테이블 껍데기(컬럼 타입)는 Postgres 스키마가 정본이다.
 *   - jsonb payload 안쪽은 스키마가 없으므로 여기(zod)가 담당한다.
 *   - 라벨(한글)은 labels.ts. DART 원본 필드명은 절대 개명하지 않는다.
 *
 * 검증 시점: 쓰기(ingest)가 아니라 **읽기 경계**다. ingest 는 DART가 뭘 보내든 원본을
 * 그대로 담고(원본 보존 원칙), UI·분석이 읽을 때 이 스키마로 해석한다. 미선언 필드는
 * passthrough 로 통과시킨다 — strict 는 전 상장사에서 반드시 깨진다.
 */
import { z } from "zod";

export * from "./labels";
export * from "./ksic";
export * from "./sectors";
export * from "./value-chain";

/** DART 금액·주식수는 "1,234,567" 같은 문자열로 온다. 숫자로 강제 변환하되 실패는 null. */
export const dartNumber = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return v;
    const s = v.replace(/,/g, "").trim();
    if (!s || s === "-" || /^#+$/.test(s)) return null; // '####' 오버플로 센티널
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  })
  .nullable();

/** "2026년 02월 10일" · "20260210" · "2026-02-10" → ISO 날짜 문자열 */
export const dartDate = z
  .union([z.string(), z.null()])
  .transform((v) => {
    if (!v) return null;
    const s = v.trim();
    let m = s.match(/^(\d{4})[-.\s]*년?[-.\s]*(\d{1,2})[-.\s]*월?[-.\s]*(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  })
  .nullable();

// ───────────────────────────────── 테이블 행

export const Company = z.object({
  corp_code: z.string(),
  name: z.string(),
  stock_code: z.string().nullable(),
  market: z.enum(["KOSPI", "KOSDAQ", "KONEX"]).nullable(),
  sector_code: z.string().nullable(),
  fiscal_month: z.number().nullable(),
  ceo: z.string().nullable(),
  established: z.string().nullable(),
});
export type Company = z.infer<typeof Company>;

export const Filing = z.object({
  rcept_no: z.string(),
  corp_code: z.string(),
  report_nm: z.string(),
  flr_nm: z.string().nullable(),
  rcept_dt: z.string(),
  rm: z.string().nullable(),
  is_correction: z.boolean(),
});
export type Filing = z.infer<typeof Filing>;

export const CorrectionChain = z.object({
  corp_code: z.string(),
  correction_rcept_no: z.string(),
  correction_dt: z.string(),
  base_report_nm: z.string(),
  original_rcept_no: z.string().nullable(),
  original_dt: z.string().nullable(),
  days_after_original: z.number().nullable(),
});
export type CorrectionChain = z.infer<typeof CorrectionChain>;

/**
 * 재무 개념 — UI가 필터·차트 축으로 쓰는 **닫힌 집합**.
 * account_id(ifrs-full_* / dart_* / 구버전 ifrs_* / 회사 커스텀)는 회사·시간 양축으로
 * 열린 집합이라 enum 이 될 수 없다(A1 실증). 열린 세계는 DB가 수용하고, 닫힌 세계는
 * account_concepts 테이블이 정의하며, 그것이 이 enum 이다.
 */
export const FinancialConcept = z.enum([
  "revenue",
  "operating_income",
  "net_income",
  "assets",
  "liabilities",
  "equity",
  "cf_operating",
  "cf_investing",
  "cf_financing",
]);
export type FinancialConcept = z.infer<typeof FinancialConcept>;

export const CONCEPT_LABELS: Record<FinancialConcept, string> = {
  revenue: "매출액",
  operating_income: "영업이익",
  net_income: "당기순이익",
  assets: "자산총계",
  liabilities: "부채총계",
  equity: "자본총계",
  cf_operating: "영업활동현금흐름",
  cf_investing: "투자활동현금흐름",
  cf_financing: "재무활동현금흐름",
};

export const AnnualSummary = z.object({
  corp_code: z.string(),
  bsns_year: z.number(),
  revenue: z.coerce.number().nullable(),
  operating_income: z.coerce.number().nullable(),
  net_income: z.coerce.number().nullable(),
  assets: z.coerce.number().nullable(),
  liabilities: z.coerce.number().nullable(),
  equity: z.coerce.number().nullable(),
  cf_operating: z.coerce.number().nullable(),
  opm_pct: z.coerce.number().nullable(),
  roe_pct: z.coerce.number().nullable(),
  debt_ratio_pct: z.coerce.number().nullable(),
});
export type AnnualSummary = z.infer<typeof AnnualSummary>;

/** 주요사항보고서 — event_type 판별자 + passthrough payload */
export const DartEvent = z.object({
  id: z.number(),
  corp_code: z.string(),
  event_type: z.string(),
  rcept_no: z.string().nullable(),
  rcept_dt: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
});
export type DartEvent = z.infer<typeof DartEvent>;

/**
 * 지분 변동 원장 — 임원·주요주주 소유상황(`elestock`)과 대량보유상황(`majorstock`).
 *
 * 주의: 이 사실들은 `events` 에 없다. `events.event_type` 은 주요사항보고서 종류만
 * 담고(자기주식취득결정·유상증자결정 등), `대량보유`·`임원ㆍ주요주주` 는 그쪽이 아니라
 * `filings.report_nm` 값이자 이 테이블의 내용이다.
 */
export const OwnershipKind = z.enum(["elestock", "majorstock"]);
export type OwnershipKind = z.infer<typeof OwnershipKind>;

export const OwnershipTxn = z.object({
  id: z.number(),
  corp_code: z.string(),
  kind: OwnershipKind,
  rcept_no: z.string().nullable(),
  rcept_dt: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
});
export type OwnershipTxn = z.infer<typeof OwnershipTxn>;

export const OWNERSHIP_KIND_LABELS: Record<OwnershipKind, string> = {
  elestock: "임원·주요주주",
  majorstock: "대량보유",
};

/**
 * 지분 원장 payload 에서 화면이 쓰는 값만 뽑는다.
 *
 * DART 원본 키를 그대로 보존하는 게 적재 원칙이라 payload 는 kind 마다 스키마가 다르다
 * (`elestock` 은 `sp_stock_lmp_*`, `majorstock` 은 `stkqy`/`stkrt`). 그 차이를 여기서
 * 한 번만 흡수한다.
 */
export function readOwnership(txn: OwnershipTxn): {
  reporter: string | null;
  /** 보유 주식수 */
  shares: number | null;
  /** 보유 비율 % */
  ratio: number | null;
  /** 증감 주식수 */
  sharesDelta: number | null;
  /** 부가 설명 — 직위(elestock) 또는 보고 사유(majorstock) */
  note: string | null;
} {
  const p = txn.payload;
  const str = (k: string): string | null => {
    const v = p[k];
    if (typeof v !== "string") return null;
    const s = v.trim();
    return !s || s === "-" ? null : s;
  };
  const numOf = (k: string): number | null => {
    const s = str(k);
    if (s === null) return null;
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  if (txn.kind === "elestock") {
    const post = str("isu_exctv_ofcps");
    const registered = str("isu_exctv_rgist_at");
    return {
      reporter: str("repror"),
      shares: numOf("sp_stock_lmp_cnt"),
      ratio: numOf("sp_stock_lmp_rate"),
      sharesDelta: numOf("sp_stock_lmp_irds_cnt"),
      note: [post, registered].filter(Boolean).join(" · ") || null,
    };
  }
  return {
    reporter: str("repror"),
    shares: numOf("stkqy"),
    ratio: numOf("stkrt"),
    sharesDelta: numOf("stkqy_irds"),
    note: str("report_resn") ?? str("report_tp"),
  };
}

/** 사실 시계열 원장 (A2 판정: 이것이 트래킹의 정본) */
export const DatePrecision = z.enum(["day", "month", "quarter", "year"]);
export type DatePrecision = z.infer<typeof DatePrecision>;

export const TrackingFact = z.object({
  id: z.number(),
  corp_code: z.string(),
  topic: z.string(),
  fact_date: z.string(),
  date_precision: DatePrecision,
  fact: z.string(),
  value_text: z.string().nullable(),
  source: z.string(),
  rcept_no: z.string().nullable(),
  tags: z.array(z.string()),
});
export type TrackingFact = z.infer<typeof TrackingFact>;

export const FilingSection = z.object({
  id: z.number(),
  rcept_no: z.string(),
  sec_no: z.number(),
  title: z.string(),
  is_note: z.boolean(),
  is_biz: z.boolean(),
  /** 섹션 원문. 목록 조회(getNoteSections)는 이 필드를 요청하지 않는다 — 주석 섹션 하나가
   *  10만자를 넘기도 해서(A3 실측 138,795자) 목록에 얹으면 안 된다. 단일 섹션 조회
   *  (getFilingSectionContent)만 이 필드를 채운다. */
  content: z.string().nullable().optional(),
});
export type FilingSection = z.infer<typeof FilingSection>;

// ───────────────────────────────── 표시 포매터

/** 원 단위 → 조/억 표기. DB는 항상 원 단위 원본을 보관하고, 환산은 표시 계층의 몫이다. */
export function formatWon(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(digits || 2)}조`;
  if (abs >= 1e8) return `${(v / 1e8).toLocaleString("ko-KR", { maximumFractionDigits: digits })}억`;
  if (abs >= 1e4) return `${(v / 1e4).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만`;
  return v.toLocaleString("ko-KR");
}

export function formatCount(v: number | null | undefined, suffix = ""): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("ko-KR") + suffix;
}

export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

/** 정밀도에 맞춰 날짜 표시 — 원장의 `2025-09-01/month` 를 "2025-09" 로 되돌린다. */
export function formatFactDate(date: string, precision: DatePrecision = "day"): string {
  if (precision === "year") return date.slice(0, 4);
  if (precision === "month") return date.slice(0, 7);
  if (precision === "quarter") {
    const q = Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1;
    return `${date.slice(0, 4)} ${q}Q`;
  }
  return date;
}

/** payload 필드 값을 unit 에 맞춰 표시 */
export function formatFieldValue(raw: unknown, unit?: string): string {
  if (raw === null || raw === undefined || raw === "" || raw === "-") return "—";
  const s = String(raw);
  switch (unit) {
    case "won": {
      const n = dartNumber.parse(s);
      return n === null ? s : formatWon(n);
    }
    case "shares": {
      const n = dartNumber.parse(s);
      return n === null ? s : formatCount(n, "주");
    }
    case "count": {
      const n = dartNumber.parse(s);
      return n === null ? s : formatCount(n);
    }
    case "percent":
      return s.endsWith("%") ? s : `${s}%`;
    case "date":
      return dartDate.parse(s) ?? s;
    default:
      return s;
  }
}
