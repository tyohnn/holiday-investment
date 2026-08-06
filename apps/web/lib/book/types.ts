/**
 * Shape of `content/book/manifest.json`, written by `scripts/sync-content.mjs`.
 * The `.md` files next to it are pure chapter bodies — every bit of metadata
 * the reader needs to build navigation lives here.
 */

export interface Chapter {
  slug: string;
  /** Full H1 as authored, e.g. `11장. 매출 추정의 기술 — 첫 칸을 어떻게 채우는가`. */
  title: string;
  description: string;
  /** 장 number parsed off the title, or null for unnumbered pages (부록). */
  number: number | null;
  /** Title without the 장 number and subtitle. */
  heading: string;
  /** Everything after the em dash, if any. */
  subtitle: string | null;
}

export interface Part {
  /** e.g. `제3부 (C). 정량 밸류에이션 기법`. Empty for an untitled opening run. */
  title: string;
  chapters: Chapter[];
}

export interface BookIntro {
  slug: 'index';
  title: string;
  description: string;
}

export interface Book {
  /** Directory name under `content/book/`, also the URL segment. */
  folder: string;
  /** Short spine label, e.g. `1권`. */
  label: string;
  title: string;
  intro: BookIntro | null;
  parts: Part[];
}

export interface ReferencePage {
  slug: string;
  title: string;
  description: string;
}

export interface Manifest {
  title: string;
  description: string;
  books: Book[];
  reference: {
    title: string;
    description: string;
    pages: ReferencePage[];
  };
}

/** A chapter plus where it sits — what prev/next and breadcrumbs need. */
export interface ChapterLocation {
  book: Book;
  part: Part;
  chapter: Chapter;
  href: string;
}
