/**
 * 플랫폼 DB 접근 레이어 — Supabase(PostgREST) 읽기 전용.
 *
 * A1·A2에서 확정된 계약만 노출한다:
 *   - 정형 재무는 annual_summary 뷰 (계정명 변형·택소노미 세대를 뷰가 흡수)
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
import {
  AnnualSummary,
  Company,
  CorrectionChain,
  DartEvent,
  Filing,
  FilingSection,
  TrackingFact,
} from "@investment/schema";
import { z } from "zod";

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

export async function getCompany(stockCode: string): Promise<Company | null> {
  const { data } = await supabaseService.from("companies").select("*").eq("stock_code", stockCode).maybeSingle();
  return data ? Company.parse(data) : null;
}

export async function getAnnualSummary(corpCode: string): Promise<AnnualSummary[]> {
  const { data, error } = await supabaseService
    .from("annual_summary")
    .select("*")
    .eq("corp_code", corpCode)
    .order("bsns_year");
  if (error) throw error;
  return parseAll(AnnualSummary, data ?? [], "annual_summary");
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

/** 단일 섹션 원문 조회 — 목록(getNoteSections)과 분리. 138KB 짜리 content 를 목록에 얹지 않는다. */
export async function getFilingSectionContent(rceptNo: string, secNo: number): Promise<FilingSection | null> {
  const { data, error } = await supabaseService
    .from('filing_sections')
    .select('id,rcept_no,sec_no,title,is_note,is_biz,content')
    .eq('rcept_no', rceptNo)
    .eq('sec_no', secNo)
    .maybeSingle();
  if (error) throw error;
  return data ? FilingSection.parse(data) : null;
}

/** rcept_no 단건 조회 — 섹션 상세 페이지가 소속 공시(제출인·보고서명·접수일·소유 회사)를 확인할 때 쓴다. */
export async function getFilingByRceptNo(rceptNo: string): Promise<Filing | null> {
  const { data, error } = await supabaseService.from('filings').select('*').eq('rcept_no', rceptNo).maybeSingle();
  if (error) throw error;
  return data ? Filing.parse(data) : null;
}

/** 목록 표시용 — filing_sections 에 소속 공시(보고서명·접수일)를 얹은 뷰. content 는 여기 없다
 *  (100KB+ 인 섹션이 있어 목록에는 얹지 않는다 — getFilingSectionContent 로 개별 조회). */
export type NoteSectionListItem = FilingSection & { report_nm: string; filing_rcept_dt: string };

export async function getNoteSections(corpCode: string, limit = 20): Promise<NoteSectionListItem[]> {
  const { data: filings } = await supabaseService
    .from("filings")
    .select("rcept_no")
    .eq("corp_code", corpCode)
    .order("rcept_dt", { ascending: false })
    .limit(60);
  const rcepts = (filings ?? []).map((f: { rcept_no: string }) => f.rcept_no);
  if (!rcepts.length) return [];
  const { data, error } = await supabaseService
    .from("filing_sections")
    .select("id,rcept_no,sec_no,title,is_note,is_biz,filings(report_nm,rcept_dt)")
    .in("rcept_no", rcepts)
    .or("is_note.eq.true,is_biz.eq.true")
    .order("rcept_no", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    // Supabase 타입은 임베드를 배열로 추론하지만 FK 단건 관계라 객체로 온다.
    const raw = row as unknown as Record<string, unknown>;
    const filing = raw.filings as { report_nm: string; rcept_dt: string } | null;
    const parsed = FilingSection.safeParse(raw);
    if (!parsed.success || !filing) return [];
    return [{ ...parsed.data, report_nm: filing.report_nm, filing_rcept_dt: filing.rcept_dt }];
  });
}

/** 개념별 연간 시계열 — annual_summary 에 없는 개념(cf_investing 등)용. */
export async function getConceptSeries(
  corpCode: string,
  concept: string,
): Promise<{ bsns_year: number; amount: number | null }[]> {
  const { data, error } = await supabaseService
    .from("financial_metrics")
    .select("bsns_year, amount")
    .eq("corp_code", corpCode)
    .eq("concept", concept)
    .eq("reprt_code", "11011")
    .order("bsns_year");
  if (error) throw error;
  const byYear = new Map<number, number | null>();
  for (const row of data ?? []) {
    const year = Number(row.bsns_year);
    const amount = row.amount === null || row.amount === undefined ? null : Number(row.amount);
    // 연결/별도 중복 시 절대값이 큰 쪽을 채택
    const prev = byYear.get(year);
    if (prev === undefined || prev === null) byYear.set(year, amount);
    else if (amount !== null && Math.abs(amount) > Math.abs(prev)) byYear.set(year, amount);
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bsns_year, amount]) => ({ bsns_year, amount }));
}

/** 종목 페이지가 필요한 것을 한 번에 (RSC 에서 병렬 fetch) */
export async function getCompanyPageData(stockCode: string) {
  const company = await getCompany(stockCode);
  if (!company) return null;
  const [annual, filings, corrections, events, trackings, sections, cfInvesting] = await Promise.all([
    getAnnualSummary(company.corp_code),
    getFilings(company.corp_code),
    getCorrectionChains(company.corp_code),
    getEvents(company.corp_code),
    getTrackings(company.corp_code),
    getNoteSections(company.corp_code),
    getConceptSeries(company.corp_code, "cf_investing"),
  ]);
  return { company, annual, filings, corrections, events, trackings, sections, cfInvesting };
}
