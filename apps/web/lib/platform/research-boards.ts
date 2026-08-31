/**
 * 리서치 보드 CRUD — service_role 전용.
 * 클라이언트에서 import 하면 키가 번들에 실린다.
 */
import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { RESEARCH_BOARDS, getResearchBoard as getSeedResearchBoard } from '@/lib/research/catalog';
import { parseBoardDocument } from '@/lib/research/document';
import type { ResearchBoard, ResearchBoardTheme } from '@/lib/research/types';
import { supabaseServiceKey, supabaseUrl } from '@/lib/platform/supabase-env';

const URL = supabaseUrl();
const SERVICE_KEY = supabaseServiceKey();

const supabase = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

type ResearchBoardRow = {
  slug: string;
  theme: string;
  title: string;
  tagline: string;
  related_stock_code: string | null;
  related_industry_slug: string | null;
  document: unknown;
};

function rowToBoard(row: ResearchBoardRow): ResearchBoard | null {
  if (row.theme !== 'stocks' && row.theme !== 'real-estate') return null;
  return {
    slug: row.slug,
    theme: row.theme,
    title: row.title,
    tagline: row.tagline ?? '',
    relatedStockCode: row.related_stock_code ?? undefined,
    relatedIndustrySlug: row.related_industry_slug ?? undefined,
    groups: parseBoardDocument(row.document),
  };
}

function toRow(board: ResearchBoard) {
  return {
    slug: board.slug,
    theme: board.theme,
    title: board.title,
    tagline: board.tagline,
    related_stock_code: board.relatedStockCode ?? null,
    related_industry_slug: board.relatedIndustrySlug ?? null,
    document: { groups: board.groups },
  };
}

function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === 'PGRST205' || /research_boards/i.test(message);
}

/**
 * 시드 보드는 마이그레이션·최초 insert 에서 한 번만 넣는다.
 * 여기서 다시 upsert 하면 사용자가 지운 보드가 목록에 되살아난다.
 * 테이블이 아직 없는 환경만 카탈로그로 읽기 폴백한다.
 */
export async function listResearchBoards(theme: ResearchBoardTheme): Promise<ResearchBoard[]> {
  const { data, error } = await supabase
    .from('research_boards')
    .select('slug, theme, title, tagline, related_stock_code, related_industry_slug, document')
    .eq('theme', theme)
    .order('updated_at', { ascending: false });
  if (error) {
    console.warn('[research_boards] list 실패:', error.message);
    return theme === 'stocks' && isMissingTable(error) ? RESEARCH_BOARDS : [];
  }
  return (data ?? []).flatMap((row) => {
    const board = rowToBoard(row);
    return board ? [board] : [];
  });
}

export async function getResearchBoard(slug: string): Promise<ResearchBoard | null> {
  const { data, error } = await supabase
    .from('research_boards')
    .select('slug, theme, title, tagline, related_stock_code, related_industry_slug, document')
    .eq('slug', slug)
    .maybeSingle();
  if (!error && data) {
    return rowToBoard(data);
  }
  if (error) {
    console.warn('[research_boards] get 실패:', error.message);
    if (isMissingTable(error)) return getSeedResearchBoard(slug) ?? null;
  }
  return null;
}

export async function upsertResearchBoard(board: ResearchBoard): Promise<ResearchBoard> {
  const { data, error } = await supabase
    .from('research_boards')
    .upsert(toRow(board), { onConflict: 'slug' })
    .select('slug, theme, title, tagline, related_stock_code, related_industry_slug, document')
    .single();
  if (error) throw error;
  return rowToBoard(data) ?? board;
}

export async function createResearchBoard(board: ResearchBoard): Promise<ResearchBoard> {
  return upsertResearchBoard(board);
}

export async function deleteResearchBoard(slug: string): Promise<void> {
  const { error } = await supabase.from('research_boards').delete().eq('slug', slug);
  if (error) throw error;
}
