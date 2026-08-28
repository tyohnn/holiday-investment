/**
 * 플랫폼 DB 접근 레이어 — Supabase(PostgREST) 읽기 전용.
 *
 * A1·A2에서 확정된 계약만 노출한다:
 *   - 정형 재무는 fin_periods 테이블 (계정명 변형·택소노미 세대는 그 적재 함수가 흡수)
 *   - 사실 시계열은 trackings 원장 (md 는 생성물이므로 UI 는 DB 를 본다)
 *   - 정정 체인은 filing_correction_chains 뷰 (파생 관계는 저장하지 않는다)
 * payload(jsonb) 해석은 @investment/schema 의 라벨 사전이 담당한다.
 *
 * 모든 읽기가 서비스 롤로 나간다. anon 으로 읽을 수 있는 게 하나도 남지 않았기
 * 때문이다 — 20260802000005 가 public 스키마의 테이블·뷰 전부에서 anon/authenticated
 * 권한을 회수했다(정책도 없음 = 전면 거부). 이건 우회가 아니라 의도한 최종 형태다:
 * anon 키는 설계상 클라이언트 번들에 실려 나가므로 anon 이 읽을 수 있는 것은 곧
 * 인터넷 전체가 읽을 수 있는 것이고, 읽기를 전부 서버로 돌리면 배포된 번들이
 * 노출하는 자격증명이 0개가 된다. 그래서 anon 클라이언트는 아예 없앴다.
 *
 * 이 모듈은 서버 전용이다 — 클라이언트 컴포넌트에서 import 하면 서비스 롤 키가
 * 브라우저 번들에 그대로 실린다. `server-only` 패키지로 빌드 타임에 막는다:
 * 클라이언트 번들에 이 모듈이 섞여 들어가면 빌드 자체가 실패한다.
 * (참고: 현재 호출자는 모두 page.tsx 의 서버 컴포넌트이며, 클라이언트 컴포넌트는
 * 타입만 `import type` 으로 참조한다 — RLS 락다운 작업에서 확인됨.)
 */
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { gunzipSync } from "node:zlib";
import {
  AnnualSummary,
  Company,
  CorrectionChain,
  DartEvent,
  Filing,
  FilingSection,
  OwnershipTxn,
  TrackingFact,
  ksicDivision,
} from "@investment/schema";
import { z } from "zod";
import { GUIDE_CONCEPTS, type GuideConcept } from "@/lib/company/guide-model";
import type { CompanyIndex } from "./company-index";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// 서비스 롤 키 — RLS 를 우회하는 유일한 입구. NEXT_PUBLIC_ 프리픽스가 아니므로
// 클라이언트 번들에는 포함되지 않는다(위 `server-only` 가 그 전제를 빌드로 강제한다).
// 폴백은 로컬 supabase start 의 데모 service_role 키로, 모든 로컬 인스턴스에서 동일하고
// 비밀이 아니다(platform/ingest/ingest.py 의 SERVICE_KEY 와 동일 — 그쪽 주석 참고).
// 호스티드를 볼 때는 apps/web/.env.local 에 NEXT_PUBLIC_SUPABASE_URL 과
// SUPABASE_SERVICE_KEY 를 둔다(gitignore 됨).
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// 이 파일의 모든 질의가 쓰는 단 하나의 클라이언트. anon 클라이언트는 제거했다 —
// 잠금 이후 anon 으로 읽을 수 있는 릴레이션이 하나도 없어 죽은 코드일 뿐이고,
// 남겨두면 "여긴 anon 으로도 되겠지" 하고 되살아난다.
const supabaseService = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

/** 스키마로 파싱하되, 계약 위반 행은 버리지 않고 로그만 남긴다(원본 보존 원칙의 연장). */
function parseAll<T>(schema: z.ZodType<T>, rows: unknown[], label: string): T[] {
  const out: T[] = [];
  for (const row of rows) {
    const r = schema.safeParse(row);
    if (r.success) out.push(r.data);
    else console.warn(`[db] ${label} 스키마 불일치:`, r.error.issues.slice(0, 2));
  }
  return out;
}

export async function listCompanies(): Promise<Company[]> {
  const { data, error } = await supabaseService.from("companies").select("*").order("name");
  if (error) throw error;
  return parseAll(Company, data ?? [], "companies");
}

const COMPANY_INDEX_PAGE = 1000;

/**
 * Command·홈이 쓰는 종목 인덱스. profile 을 빼서 행을 가볍게 두고,
 * PostgREST 기본 1000행 상한을 페이지로 넘는다.
 */
export async function listCompanyIndex(): Promise<CompanyIndex[]> {
  const out: CompanyIndex[] = [];
  for (let offset = 0; ; offset += COMPANY_INDEX_PAGE) {
    const { data, error } = await supabaseService
      .from("companies")
      .select("stock_code,name,market,sector_code")
      .not("stock_code", "is", null)
      .order("name")
      .range(offset, offset + COMPANY_INDEX_PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []).flatMap((row) => {
      if (!row.stock_code || !row.name) return [];
      const market =
        row.market === 'KOSPI' || row.market === 'KOSDAQ' || row.market === 'KONEX'
          ? row.market
          : null;
      return [
        {
          stock_code: row.stock_code,
          name: row.name,
          market,
          sector_code: typeof row.sector_code === 'string' ? row.sector_code : null,
        } satisfies CompanyIndex,
      ];
    });
    out.push(...rows);
    if (rows.length < COMPANY_INDEX_PAGE) break;
  }
  return out;
}

export async function getCompany(stockCode: string): Promise<Company | null> {
  const { data } = await supabaseService.from("companies").select("*").eq("stock_code", stockCode).maybeSingle();
  return data ? Company.parse(data) : null;
}

/**
 * fin_periods 에서 AnnualSummary 계약이 요구하는 열 — 스키마와 1:1 이고 그 이상은 없다.
 * `select("*")` 를 쓰지 않는 이유: fin_periods 는 wide 테이블이라 cogs·ebitda·net_debt 등
 * 20여 개가 더 붙어 있고, 그게 전부 파서를 통과해 버리면 "뷰가 노출하던 표면"이라는 계약이
 * 조용히 넓어진다. 계약을 넓히는 건 이 작업의 범위가 아니다(성능 교체이지 기능 변경이 아니다).
 */
const ANNUAL_COLS = [
  "corp_code",
  "bsns_year",
  "revenue",
  "operating_income",
  "net_income",
  "assets",
  "liabilities",
  "equity",
  "cf_operating",
  "opm_pct",
  "roe_pct",
  "debt_ratio_pct",
] as const;

/**
 * fin_periods 의 PK 는 (corp_code, period_key, fs_div) 라 한 연도에 연결(CFS)·별도(OFS)가
 * 둘 다 있을 수 있다. 대체되는 annual_summary 뷰는 fs_div 를 축으로 갖지 않고 개념별
 * `max(amount)` 로 뭉갰으므로, 여기서도 연도당 한 행으로 접어야 출력이 같아진다.
 *
 * 규칙: **연결이 있으면 연결을 쓴다.** 실측상 이 분기는 지금 한 번도 타지 않는다 —
 * 호스티드 fin_periods 의 period_type='A' 22,603행 전수에서 (corp_code, bsns_year) 가
 * CFS·OFS 를 동시에 갖는 경우는 0건이다. 다만 그건 finstate_all 적재가 그렇게 생겼다는
 * 사실일 뿐 스키마가 보장하는 성질이 아니므로, 단건을 가정하지 않고 규칙을 명시해 둔다.
 * (뷰의 max 규칙을 흉내내지 않는 이유: max 는 개념별로 따로 걸려 연결·별도가 한 행에서
 * 섞일 수 있고, 비율까지 그 섞인 값에서 다시 계산해야 한다. 재무제표 한 벌을 통째로
 * 고르는 쪽이 회계적으로 옳다.)
 */
function collapseByYear<T extends { bsns_year: number; fs_div: string }>(rows: T[]): T[] {
  const byYear = new Map<number, T>();
  for (const row of rows) {
    const prev = byYear.get(row.bsns_year);
    if (!prev || (prev.fs_div !== "CFS" && row.fs_div === "CFS")) byYear.set(row.bsns_year, row);
  }
  return [...byYear.values()].sort((a, b) => a.bsns_year - b.bsns_year);
}

export async function getAnnualSummary(corpCode: string): Promise<AnnualSummary[]> {
  const { data, error } = await supabaseService
    .from("fin_periods")
    .select([...ANNUAL_COLS, "fs_div"].join(","))
    .eq("corp_code", corpCode)
    .eq("period_type", "A")
    .order("bsns_year");
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Record<string, unknown> & {
    bsns_year: number;
    fs_div: string;
  })[];
  // fs_div 는 접는 데만 쓰고 계약 밖으로 내보내지 않는다.
  const picked = collapseByYear(rows).map((row) =>
    Object.fromEntries(ANNUAL_COLS.map((col) => [col, row[col]])),
  );
  return parseAll(AnnualSummary, picked, "fin_periods(A)");
}

export async function getFilings(corpCode: string, limit = 40): Promise<Filing[]> {
  const { data, error } = await supabaseService
    .from("filings")
    .select("*")
    .eq("corp_code", corpCode)
    .order("rcept_dt", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return parseAll(Filing, data ?? [], "filings");
}

/**
 * 지분 변동 원장. `events` 에는 없는 사실이다 — 자세한 이유는 schema 의 `OwnershipTxn` 주석.
 */
export async function getOwnershipTxns(
  corpCode: string,
  limit = 60,
): Promise<OwnershipTxn[]> {
  const { data, error } = await supabaseService
    .from("ownership_txns")
    .select("*")
    .eq("corp_code", corpCode)
    .order("rcept_dt", { ascending: false })
    // 같은 날 여러 보고가 흔하다(가족 간 이동은 매도·매수가 같은 날짜다). 2차 정렬이
    // 없으면 목록 순서가 조회마다 달라져 화면 헤드라인도 같이 흔들린다.
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return parseAll(OwnershipTxn, data ?? [], "ownership_txns");
}

/**
 * 주제어로 공시 목록을 긁는다 — 지분·배당처럼 **`events` 에 안 실리는** 사실을 화면이
 * 1차 자료로라도 보여주기 위한 통로다.
 *
 * `events.event_type` 은 주요사항보고서 종류만 담아서 대량보유·주요주주·배당이 통째로
 * 빠진다. 그 셋은 `filings.report_nm` 에 있고(전역 배당 공시만 36,705건), 파싱된 상세가
 * 없더라도 "언제 무슨 공시가 있었나"는 그대로 읽힌다.
 */
const THEMED_FILING_PATTERNS = ["대량보유", "주요주주", "배당", "자기주식", "자사주"] as const;

export async function getThemedFilings(corpCode: string, limit = 120): Promise<Filing[]> {
  const or = THEMED_FILING_PATTERNS.map((p) => `report_nm.like.*${p}*`).join(",");
  const { data, error } = await supabaseService
    .from("filings")
    .select("*")
    .eq("corp_code", corpCode)
    .or(or)
    .order("rcept_dt", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return parseAll(Filing, data ?? [], "themed_filings");
}

export async function getCorrectionChains(corpCode: string, limit = 10): Promise<CorrectionChain[]> {
  const { data } = await supabaseService
    .from("filing_correction_chains")
    .select("*")
    .eq("corp_code", corpCode)
    .order("correction_dt", { ascending: false })
    .limit(limit);
  return parseAll(CorrectionChain, data ?? [], "correction_chains");
}

export async function getEvents(corpCode: string): Promise<DartEvent[]> {
  const { data, error } = await supabaseService
    .from("events")
    .select("*")
    .eq("corp_code", corpCode)
    .order("rcept_no", { ascending: false });
  if (error) throw error;
  return parseAll(DartEvent, data ?? [], "events");
}

/** 수작업 큐레이션 원장 — md 가 아니라 DB 가 원본이다. */
export async function getTrackings(corpCode: string): Promise<TrackingFact[]> {
  const { data, error } = await supabaseService
    .from("trackings")
    .select("*")
    .eq("corp_code", corpCode)
    .order("fact_date");
  if (error) throw error;
  return parseAll(TrackingFact, data ?? [], "trackings");
}

/**
 * 공시 섹션의 저장 위치 — Postgres(filing_sections) 대신 Storage 객체
 * docs/<corp_code>/<rcept_no>.sections.json.gz (버킷 platform-raw). platform/ingest/docs_storage.py
 * 가 쓰는 것과 동일한 버킷·경로 규약 — 새 상수를 여기서 발명하는 게 아니라 그쪽 규약을 그대로
 * 옮겨 적은 것이다(자연키 교훈과 같은 이유로, 실제 분할·경로 로직은 Python 쪽 한 곳에만 있다).
 */
const DOCS_STORAGE_BUCKET = "platform-raw";

function sectionsObjectPath(corpCode: string, rceptNo: string): string {
  return `docs/${corpCode}/${rceptNo}.sections.json.gz`;
}

/** Storage 에서 gzip JSON 섹션 배열을 받아 파싱한다. 객체가 없으면(아직 추출 안 됐거나
 *  정기보고서가 아닌 공시) null — 호출부는 이 rcept_no 를 조용히 건너뛴다(에러가 아니다). */
async function downloadSectionsObject(
  corpCode: string,
  rceptNo: string,
): Promise<{ rcept_no: string; sec_no: number; title: string; content: string; is_note: boolean; is_biz: boolean }[] | null> {
  const { data, error } = await supabaseService.storage
    .from(DOCS_STORAGE_BUCKET)
    .download(sectionsObjectPath(corpCode, rceptNo));
  if (error || !data) return null;
  const gz = Buffer.from(await data.arrayBuffer());
  try {
    const json = JSON.parse(gunzipSync(gz).toString("utf-8"));
    return Array.isArray(json) ? json : null;
  } catch {
    return null;
  }
}

/** 단일 섹션 원문 조회 — 목록(getNoteSections)과 분리. 138KB 짜리 content 를 목록에 얹지 않는다.
 *  Storage 객체 하나(그 rcept_no 전체 섹션)를 받아 sec_no 로 골라낸다 — Postgres 시절처럼
 *  섹션 하나만 별도로 조회할 수는 없다(Storage 객체 단위가 rcept_no 이지 섹션이 아니다),
 *  다만 이 페이지가 받는 객체는 여전히 1개뿐이라 목록 페이지보다 가볍다. id 는 Storage 에
 *  더 이상 없는 Postgres identity 였으므로 sec_no 로 대체한다(FilingSection.id 는 UI 에서
 *  React key 로만 쓰이고, 단일 조회 페이지에서는 아예 안 쓰인다). */
export async function getFilingSectionContent(rceptNo: string, secNo: number): Promise<FilingSection | null> {
  const { data: filing, error } = await supabaseService
    .from("filings")
    .select("corp_code")
    .eq("rcept_no", rceptNo)
    .maybeSingle();
  if (error) throw error;
  if (!filing) return null;
  const sections = await downloadSectionsObject(filing.corp_code as string, rceptNo);
  if (!sections) return null;
  const row = sections.find((s) => s.sec_no === secNo);
  if (!row) return null;
  const parsed = FilingSection.safeParse({ ...row, id: row.sec_no });
  return parsed.success ? parsed.data : null;
}

/** rcept_no 단건 조회 — 섹션 상세 페이지가 소속 공시(제출인·보고서명·접수일·소유 회사)를 확인할 때 쓴다. */
export async function getFilingByRceptNo(rceptNo: string): Promise<Filing | null> {
  const { data, error } = await supabaseService.from('filings').select('*').eq('rcept_no', rceptNo).maybeSingle();
  if (error) throw error;
  return data ? Filing.parse(data) : null;
}

/** 목록 표시용 — Storage 섹션 객체에 소속 공시(보고서명·접수일)를 얹은 뷰. content 는 여기
 *  없다(100KB+ 인 섹션이 있어 목록에는 얹지 않는다 — getFilingSectionContent 로 개별 조회). */
export type NoteSectionListItem = FilingSection & { report_nm: string; filing_rcept_dt: string };

// docs_storage.py 가 섹션 객체를 만드는 대상과 정확히 같은 필터(정기보고서만) — 여기서 후보를
// 더 넓게 잡아봐야 어차피 다운로드가 404(객체 없음)로 스킵되니 의미가 없고, 좁혀야 후보
// filings 조회 자체가 정기보고서 위주로 온다.
const REGULAR_REPORT_PATTERNS = ["사업보고서", "분기보고서", "반기보고서"] as const;

// 한 페이지 로드에서 내려받는 Storage 객체 수의 상한. 이 목록은 회사 페이지의 부속
// 섹션이라(getCompanyPageData 가 다른 8개 쿼리와 Promise.all 로 병렬 실행) 여기서 N 개를
// 전부 내려받으면 그만큼 그 페이지 응답이 느려진다. 사업보고서·분기보고서·반기보고서는
// 합쳐서 연 4회쯤 나오므로 5건이면 최근 1년 남짓을 덮는다 — AGENTS.md 가 권장하는 3~5건의
// 상단을 택했다(주석·사업의 내용은 오래된 분기보다 최신 분기가 훨씬 자주 인용된다).
const NOTE_SECTIONS_FILING_CANDIDATES = 5;

export async function getNoteSections(corpCode: string, limit = 20): Promise<NoteSectionListItem[]> {
  const or = REGULAR_REPORT_PATTERNS.map((p) => `report_nm.like.*${p}*`).join(",");
  const { data: filings, error } = await supabaseService
    .from("filings")
    .select("rcept_no,report_nm,rcept_dt")
    .eq("corp_code", corpCode)
    .or(or)
    .order("rcept_dt", { ascending: false })
    .limit(NOTE_SECTIONS_FILING_CANDIDATES);
  if (error) throw error;
  if (!filings?.length) return [];

  const out: NoteSectionListItem[] = [];
  for (const filing of filings as { rcept_no: string; report_nm: string; rcept_dt: string }[]) {
    if (out.length >= limit) break;
    const sections = await downloadSectionsObject(corpCode, filing.rcept_no);
    if (!sections) continue; // 아직 추출 안 됐거나(비관심 종목) 정기보고서가 아니었던 경우
    for (const row of sections) {
      if (!(row.is_note || row.is_biz)) continue;
      if (out.length >= limit) break;
      // content 는 목록에 얹지 않는다(주석 하나가 10만자를 넘기도 한다 — FilingSection 주석 참고).
      const { content: _content, ...rest } = row;
      const parsed = FilingSection.safeParse({ ...rest, id: row.sec_no });
      if (!parsed.success) continue;
      out.push({ ...parsed.data, report_nm: filing.report_nm, filing_rcept_dt: filing.rcept_dt });
    }
  }
  return out;
}

/**
 * getConceptSeries 가 받을 수 있는 개념 — fin_periods 의 지표 컬럼 이름 그대로다.
 *
 * financial_metrics 에서는 개념이 **행**이었으므로 인자가 `string` 이어도 무해했다(없는
 * 이름은 0행). fin_periods 에서는 개념이 **컬럼**이라 이름이 곧 select 문자열에 들어가고,
 * 틀린 이름은 런타임 PostgREST 에러가 된다. 그래서 자유 문자열을 리터럴 합집합으로 좁힌다 —
 * 오타는 컴파일에서 잡히고, 목록에 있는 이름은 전부 실제로 동작한다("사실상 한 값만 되는
 * 인자"를 남기지 않는다는 뜻).
 */
export type FinPeriodConcept = GuideConcept;

/**
 * 가이드 표가 쓰는 넓은 재무 슬라이스. AnnualSummary 계약을 넓히지 않는다 —
 * 계정 트리는 여기 값만 집어 넣고, 없는 칸은 화면이 공칸으로 둔다.
 */
export type GuideFinValues = Partial<Record<GuideConcept, number | null>>;

export type GuideFinPeriod = {
  year: number;
  periodType: string;
  periodKey: string;
  fsDiv: string;
  values: GuideFinValues;
};

function collapseByPeriodKey<T extends { period_key: string; fs_div: string }>(rows: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const prev = byKey.get(row.period_key);
    if (!prev || (prev.fs_div !== "CFS" && row.fs_div === "CFS")) byKey.set(row.period_key, row);
  }
  return [...byKey.values()].sort((a, b) => a.period_key.localeCompare(b.period_key));
}

function toGuideFinPeriod(row: Record<string, unknown> & {
  bsns_year: number;
  period_type: string;
  period_key: string;
  fs_div: string;
}): GuideFinPeriod {
  const values: GuideFinValues = {};
  for (const key of GUIDE_CONCEPTS) {
    const raw = row[key];
    values[key] = raw === null || raw === undefined || raw === "" ? null : Number(raw);
    if (values[key] !== null && values[key] !== undefined && !Number.isFinite(values[key])) {
      values[key] = null;
    }
  }
  return {
    year: row.bsns_year,
    periodType: row.period_type,
    periodKey: row.period_key,
    fsDiv: row.fs_div,
    values,
  };
}

export async function getGuideFinGrid(corpCode: string): Promise<{
  annual: GuideFinPeriod[];
  quarters: GuideFinPeriod[];
}> {
  const { data, error } = await supabaseService
    .from("fin_periods")
    .select(["bsns_year", "period_type", "period_key", "fs_div", ...GUIDE_CONCEPTS].join(","))
    .eq("corp_code", corpCode)
    .in("period_type", ["A", "Q1", "Q2", "Q3", "Q4"])
    .order("period_key");
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Record<string, unknown> & {
    bsns_year: number;
    period_type: string;
    period_key: string;
    fs_div: string;
  })[];
  const annualRows = rows.filter((row) => row.period_type === "A");
  const quarterRows = rows.filter((row) => row.period_type !== "A");
  return {
    annual: collapseByYear(annualRows).map(toGuideFinPeriod),
    quarters: collapseByPeriodKey(quarterRows).map(toGuideFinPeriod),
  };
}

/** 개념별 연간 시계열 — AnnualSummary 계약에 없는 개념(cf_investing 등)용. */
export async function getConceptSeries(
  corpCode: string,
  concept: FinPeriodConcept,
): Promise<{ bsns_year: number; amount: number | null }[]> {
  const { data, error } = await supabaseService
    .from("fin_periods")
    .select(`bsns_year, fs_div, ${concept}`)
    .eq("corp_code", corpCode)
    .eq("period_type", "A")
    // 값이 없는 연도는 아예 내보내지 않는다. 대체되는 financial_metrics 뷰가
    // `where amount is not null` 이라 그 개념이 잡히지 않은 연도는 행 자체가 없었다.
    // fin_periods 는 연도 행이 먼저 있고 컬럼이 비므로, 여기서 걸러야 결과가 같다.
    // (실측: 신테카바이오 2019 는 A 행은 있으나 cf_investing 이 NULL 이다.)
    .not(concept, "is", null)
    .order("bsns_year");
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Record<string, unknown> & {
    bsns_year: number;
    fs_div: string;
  })[];
  // 연결/별도 중복 처리는 getAnnualSummary 와 같은 규칙(연결 우선)을 쓴다 — 한 화면에서
  // 두 함수의 결과가 나란히 놓이므로 서로 다른 재무제표를 고르면 안 된다.
  return collapseByYear(rows).map((row) => ({
    bsns_year: row.bsns_year,
    amount: row[concept] === null || row[concept] === undefined ? null : Number(row[concept]),
  }));
}

/** 종목 페이지가 필요한 것을 한 번에 (RSC 에서 병렬 fetch) */
export async function getCompanyPageData(stockCode: string) {
  const company = await getCompany(stockCode);
  if (!company) return null;
  const [
    annual, filings, corrections, events, trackings, sections, cfInvesting,
    ownershipTxns, themedFilings, guideFin,
  ] = await Promise.all([
    getAnnualSummary(company.corp_code),
    getFilings(company.corp_code),
    getCorrectionChains(company.corp_code),
    getEvents(company.corp_code),
    getTrackings(company.corp_code),
    getNoteSections(company.corp_code),
    getConceptSeries(company.corp_code, "cf_investing"),
    getOwnershipTxns(company.corp_code),
    getThemedFilings(company.corp_code),
    getGuideFinGrid(company.corp_code),
  ]);
  return {
    company, annual, filings, corrections, events, trackings, sections, cfInvesting,
    ownershipTxns, themedFilings, guideFin,
  };
}

export type CompanyPageData = NonNullable<Awaited<ReturnType<typeof getCompanyPageData>>>;

/* ── 산업 지도 ─────────────────────────────────────────────────────────────── */

export interface DivisionCount {
  /** KSIC 중분류 2자리 */
  division: string;
  kospi: number;
  kosdaq: number;
  total: number;
}

/**
 * 상장사를 KSIC 중분류로 집계한다 — 산업 지도의 배경 격자.
 *
 * PostGREST 에는 group by 가 없고 이 프로젝트는 호스티드 DB에 뷰를 새로 얹지 않으므로
 * (마이그레이션은 platform/ 의 소관이다) 행을 받아 여기서 접는다. 고르는 열은 3개뿐이라
 * 2,648행이어도 가볍다. **기본 limit 1000 을 넘기므로 반드시 페이지네이션한다** — 조용히
 * 잘린 표본은 이 저장소에서 가장 흔한 오류원이다.
 */
export async function getListedDivisionCounts(): Promise<{
  divisions: DivisionCount[];
  totalListed: number;
}> {
  const PAGE = 1000;
  const rows: { sector_code: string | null; market: string | null }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabaseService
      .from("companies")
      .select("sector_code, market")
      .in("market", ["KOSPI", "KOSDAQ"])
      .order("stock_code")
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  const byDivision = new Map<string, DivisionCount>();
  for (const row of rows) {
    const division = ksicDivision(row.sector_code);
    if (!division) continue;
    let entry = byDivision.get(division);
    if (!entry) {
      entry = { division, kospi: 0, kosdaq: 0, total: 0 };
      byDivision.set(division, entry);
    }
    if (row.market === "KOSPI") entry.kospi += 1;
    else if (row.market === "KOSDAQ") entry.kosdaq += 1;
    entry.total += 1;
  }

  return {
    divisions: [...byDivision.values()].sort((a, b) => b.total - a.total),
    totalListed: rows.length,
  };
}

/** 종목코드 여러 개를 한 번에 — 산업 상세가 소속사를 전부 확인할 때 쓴다. */
export async function getCompaniesByStockCodes(stockCodes: string[]): Promise<Company[]> {
  if (stockCodes.length === 0) return [];
  const { data, error } = await supabaseService
    .from("companies")
    .select("*")
    .in("stock_code", stockCodes);
  if (error) throw error;
  return parseAll(Company, data ?? [], "companies(byStockCodes)");
}

export interface MemberFinancials {
  bsns_year: number;
  fs_div: string;
  revenue: number | null;
  opm_pct: number | null;
  roe_pct: number | null;
  debt_ratio_pct: number | null;
}

/**
 * 산업 소속사들의 연간 재무를 한 번에. 카탈로그에 숫자를 적어 두지 않는 대신 여기서 읽는다.
 *
 * 연결·별도가 한 해에 둘 다 있으면 `collapseByYear` 와 같은 규칙(연결 우선)으로 접는다 —
 * 같은 화면에서 회사마다 다른 재무제표를 고르면 표가 비교 불가능해진다. 연결이 아예 없는
 * 회사(에코프로머티 등)는 별도만 남으므로 그 기준을 화면에 표기한다.
 */
export async function getAnnualByCorpCodes(
  corpCodes: string[],
  years: number[],
): Promise<Map<string, MemberFinancials[]>> {
  const out = new Map<string, MemberFinancials[]>();
  if (corpCodes.length === 0 || years.length === 0) return out;

  const { data, error } = await supabaseService
    .from("fin_periods")
    .select("corp_code, bsns_year, fs_div, revenue, opm_pct, roe_pct, debt_ratio_pct")
    .in("corp_code", corpCodes)
    .in("bsns_year", years)
    .eq("period_type", "A");
  if (error) throw error;

  const grouped = new Map<string, (MemberFinancials & { corp_code: string })[]>();
  for (const row of (data ?? []) as (MemberFinancials & { corp_code: string })[]) {
    const list = grouped.get(row.corp_code) ?? [];
    list.push(row);
    grouped.set(row.corp_code, list);
  }
  for (const [corpCode, list] of grouped) out.set(corpCode, collapseByYear(list));
  return out;
}
