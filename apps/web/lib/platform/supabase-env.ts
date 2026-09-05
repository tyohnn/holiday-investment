/**
 * 서버 전용 Supabase 접속값.
 *
 * NEXT_PUBLIC_SUPABASE_URL 을 `process.env.NEXT_PUBLIC_…` 리터럴로 읽으면 Next가
 * 빌드 때 값을 박아버린다. Vercel 프로젝트에 URL이 없으면 그 자리에는
 * `undefined` 가 들어가고, 아래 로컬 폴백 `127.0.0.1:54321` 이 배포 런타임에도
 * 남는다 — 종목 검색이 비는 원인이 바로 그것이다.
 *
 * 키를 `process.env[name]` 으로 읽고, Cloud Agent 시크릿 이름인
 * SUPABASE_REST_URL 도 받는다. 클라이언트 번들에는 실리지 않는다.
 */
import 'server-only';

export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';

// supabase start 데모 service_role — 모든 로컬 인스턴스에서 같고 비밀이 아니다.
export const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const REST_SUFFIX = '/rest/v1';

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function originFromRestUrl(rest: string): string {
  const trimmed = rest.replace(/\/$/, '');
  return trimmed.endsWith(REST_SUFFIX) ? trimmed.slice(0, -REST_SUFFIX.length) : trimmed;
}

export function supabaseUrl(): string {
  const direct = readEnv('SUPABASE_URL') ?? readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const rest = readEnv('SUPABASE_REST_URL');
  const hosted = (direct ?? (rest ? originFromRestUrl(rest) : undefined))?.replace(/\/$/, '');
  if (hosted) return hosted;
  if (process.env.VERCEL) {
    console.error(
      '[db] Supabase URL missing on Vercel. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_REST_URL, plus SUPABASE_SERVICE_KEY.',
    );
  }
  return LOCAL_SUPABASE_URL;
}

export function supabaseServiceKey(): string {
  return readEnv('SUPABASE_SERVICE_KEY') ?? LOCAL_SERVICE_KEY;
}
