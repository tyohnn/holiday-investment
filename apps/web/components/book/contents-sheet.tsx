'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ListBulletsIcon } from '@phosphor-icons/react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { Manifest } from '@/lib/book/types';

/**
 * The whole shelf in one drawer — every 권, every 부, every 장.
 *
 * A book's table of contents belongs on demand, not pinned open next to the
 * text: the always-visible tree is what makes a docs site feel like a docs
 * site. Closing on navigation keeps it out of the way once a chapter is picked.
 */
export function ContentsSheet({
  manifest,
  currentBook,
  currentSlug,
}: {
  manifest: Manifest;
  currentBook?: string;
  currentSlug?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <ListBulletsIcon />
          목차
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(22rem,90vw)] p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{manifest.title}</SheetTitle>
          <SheetDescription>{manifest.description}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100svh-6.5rem)]">
          <nav className="px-4 pb-10 text-sm" aria-label="전체 목차">
            {manifest.books.map((book) => (
              <section key={book.folder} className="mt-5 first:mt-3">
                <Link
                  href={`/book/${book.folder}`}
                  onClick={() => setOpen(false)}
                  className="block font-semibold hover:text-primary"
                >
                  {book.title}
                </Link>
                {book.parts.map((part) => (
                  <div key={part.title} className="mt-4">
                    {part.title ? (
                      <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground">
                        {part.title}
                      </p>
                    ) : null}
                    <ul className="space-y-0.5 border-l">
                      {part.chapters.map((chapter) => {
                        const active =
                          book.folder === currentBook && chapter.slug === currentSlug;
                        return (
                          <li key={chapter.slug}>
                            <Link
                              href={`/book/${book.folder}/${chapter.slug}`}
                              onClick={() => setOpen(false)}
                              aria-current={active ? 'page' : undefined}
                              className={cn(
                                '-ml-px flex gap-2 border-l py-1 pl-3 text-muted-foreground transition-colors',
                                'hover:border-foreground/40 hover:text-foreground',
                                active && 'border-primary font-medium text-primary',
                              )}
                            >
                              {chapter.number ? (
                                <span className="w-6 shrink-0 tabular-nums">
                                  {chapter.number}
                                </span>
                              ) : null}
                              <span className="min-w-0">{chapter.heading}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            ))}

            <section className="mt-6 border-t pt-4">
              <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground">
                {manifest.reference.title}
              </p>
              <ul className="space-y-0.5">
                {manifest.reference.pages.map((page) => (
                  <li key={page.slug}>
                    <Link
                      href={`/book/reference/${page.slug}`}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'block py-1 text-muted-foreground transition-colors hover:text-foreground',
                        currentBook === 'reference' &&
                          currentSlug === page.slug &&
                          'font-medium text-primary',
                      )}
                    >
                      {page.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
