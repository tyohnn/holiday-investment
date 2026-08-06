import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Book, Chapter, ChapterLocation, Manifest, Part } from './types';

/** Where `scripts/sync-content.mjs` writes. Gitignored, regenerated on predev. */
const CONTENT_DIR = path.join(process.cwd(), 'content', 'book');

export const bookRoute = '/book';

let cached: Manifest | undefined;

export async function getManifest(): Promise<Manifest> {
  cached ??= JSON.parse(
    await fs.readFile(path.join(CONTENT_DIR, 'manifest.json'), 'utf8'),
  ) as Manifest;
  return cached;
}

export async function getBook(folder: string): Promise<Book | undefined> {
  const manifest = await getManifest();
  return manifest.books.find((book) => book.folder === folder);
}

export function chaptersOf(book: Book): Chapter[] {
  return book.parts.flatMap((part) => part.chapters);
}

export function partOf(book: Book, slug: string): Part | undefined {
  return book.parts.find((part) => part.chapters.some((c) => c.slug === slug));
}

export function chapterHref(book: Book, slug: string): string {
  return `${bookRoute}/${book.folder}/${slug}`;
}

export function bookHref(book: Book): string {
  return `${bookRoute}/${book.folder}`;
}

/**
 * Reading order across the whole shelf: 1권's chapters, then 2권's, then the
 * reference pages. Prev/next walks this list so the last chapter of a book
 * hands off to the next book instead of dead-ending.
 */
export async function getReadingOrder(): Promise<ChapterLocation[]> {
  const manifest = await getManifest();
  return manifest.books.flatMap((book) =>
    book.parts.flatMap((part) =>
      part.chapters.map((chapter) => ({
        book,
        part,
        chapter,
        href: chapterHref(book, chapter.slug),
      })),
    ),
  );
}

export interface ChapterNeighbours {
  location: ChapterLocation;
  previous: ChapterLocation | null;
  next: ChapterLocation | null;
  /** 1-based position in the whole book (not the 장 number, which can skip). */
  position: number;
  total: number;
}

export async function getChapter(
  folder: string,
  slug: string,
): Promise<ChapterNeighbours | undefined> {
  const order = await getReadingOrder();
  const index = order.findIndex(
    (entry) => entry.book.folder === folder && entry.chapter.slug === slug,
  );
  if (index === -1) return undefined;

  const withinBook = order.filter((entry) => entry.book.folder === folder);

  return {
    location: order[index],
    previous: order[index - 1] ?? null,
    next: order[index + 1] ?? null,
    position: withinBook.findIndex((entry) => entry.chapter.slug === slug) + 1,
    total: withinBook.length,
  };
}

/** Raw Markdown body of a page, relative to `content/book/`. */
export function readMarkdown(relativePath: string): Promise<string> {
  return fs.readFile(path.join(CONTENT_DIR, relativePath), 'utf8');
}
