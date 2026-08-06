import hiddenBooksConfig from './hidden-books.json';

/**
 * Books flagged `true` in `hidden-books.json` are hidden from the public
 * site: `scripts/sync-content.mjs` doesn't generate their content/book
 * pages or manifest entry, and every app-level component that hardcodes a
 * `/book/<folder>` href (home page, company-analysis widgets, ...) must route
 * through the helpers below so it never links to a page that doesn't exist.
 *
 * To re-publish a book, edit `hidden-books.json` — nothing in this file.
 */
const HIDDEN_BOOK_FOLDERS = new Set(
  Object.entries(hiddenBooksConfig)
    .filter(([key, value]) => key !== '_comment' && value === true)
    .map(([key]) => key),
);

export function isBookHidden(folder: string): boolean {
  return HIDDEN_BOOK_FOLDERS.has(folder);
}

/** True if `href` points into a hidden book (e.g. `/book/book2`, `/book/book2/D1`). */
export function isHiddenBookHref(href: string): boolean {
  for (const folder of HIDDEN_BOOK_FOLDERS) {
    if (href === `/book/${folder}` || href.startsWith(`/book/${folder}/`)) return true;
  }
  return false;
}
