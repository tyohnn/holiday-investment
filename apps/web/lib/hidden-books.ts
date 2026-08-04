import hiddenBooksConfig from './hidden-books.json';

/**
 * Books flagged `true` in `hidden-books.json` are hidden from the public
 * site: `scripts/sync-content.mjs` doesn't generate their content/docs
 * pages, and every app-level component that hardcodes a `/docs/<book>` href
 * (home page, company-analysis widgets, ...) must route through the helpers
 * below so it never links to a page that doesn't exist.
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

/** True if `href` points into a hidden book's docs tree (e.g. `/docs/book2`, `/docs/book2/D1`). */
export function isHiddenDocsHref(href: string): boolean {
  for (const folder of HIDDEN_BOOK_FOLDERS) {
    if (href === `/docs/${folder}` || href.startsWith(`/docs/${folder}/`)) return true;
  }
  return false;
}
