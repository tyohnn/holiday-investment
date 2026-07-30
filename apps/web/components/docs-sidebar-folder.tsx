'use client';

import type { ReactNode } from 'react';
import type { Folder } from 'fumadocs-core/page-tree';
import Link from 'fumadocs-core/link';
import { usePathname } from 'fumadocs-core/framework';
import { useTreePath } from 'fumadocs-ui/contexts/tree';
import {
  useAutoScroll,
  useSidebar,
} from 'fumadocs-ui/components/sidebar/base';
import { useEffect, useRef, useState } from 'react';
import {
  Accordion,
  AccordionChevronTrigger,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/cn';

function normalize(url: string) {
  return url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url;
}

function isExactActive(href: string, pathname: string) {
  return normalize(href) === normalize(pathname);
}

const rowClassName = cn(
  'group relative flex w-full flex-row items-stretch rounded-lg text-fd-muted-foreground',
  'transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80',
  'has-[[data-active=true]]:bg-fd-primary/10 has-[[data-active=true]]:text-fd-primary',
);

const titleClassName = cn(
  'flex min-w-0 flex-1 items-center gap-2 rounded-lg p-2 pe-1 text-start wrap-anywhere outline-none focus-visible:ring-2 focus-visible:ring-fd-ring',
  '[&_svg]:size-4 [&_svg]:shrink-0',
);

function FolderIndexLink({
  href,
  external,
  active,
  children,
}: {
  href: string;
  external?: boolean;
  active: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { prefetch } = useSidebar();
  useAutoScroll(active, ref);

  return (
    <Link
      ref={ref}
      href={href}
      external={external}
      data-active={active}
      prefetch={prefetch}
      className={titleClassName}
    >
      {children}
    </Link>
  );
}

function FolderContent({ children }: { children: ReactNode }) {
  return (
    <AccordionContent className="relative pb-0 before:absolute before:inset-y-1 before:inset-s-2.5 before:w-px before:bg-fd-border before:content-['']">
      <div className="flex flex-col gap-0.5 pt-0.5">{children}</div>
    </AccordionContent>
  );
}

export function DocsSidebarFolder({
  item,
  children,
}: {
  item: Folder;
  children: ReactNode;
}) {
  const path = useTreePath();
  const pathname = usePathname();
  const inPath = path.includes(item);
  const collapsible = item.collapsible !== false;
  const [open, setOpen] = useState(
    !collapsible || inPath || item.defaultOpen === true,
  );

  useEffect(() => {
    if (inPath) setOpen(true);
  }, [inPath]);

  return (
    <Accordion
      type="single"
      value={open ? 'content' : ''}
      onValueChange={(value) => setOpen(value === 'content')}
      collapsible={collapsible}
    >
      <AccordionItem value="content" className="border-b-0">
        <AccordionHeader className={rowClassName}>
          {item.index ? (
            <FolderIndexLink
              href={item.index.url}
              external={item.index.external}
              active={isExactActive(item.index.url, pathname)}
            >
              {item.icon}
              {item.name}
            </FolderIndexLink>
          ) : (
            <AccordionTrigger className="min-w-0 flex-1 p-2 pe-1 text-start hover:no-underline">
              <span className="flex items-center gap-2">
                {item.icon}
                {item.name}
              </span>
            </AccordionTrigger>
          )}
          {item.index && collapsible ? (
            <AccordionChevronTrigger
              aria-label={open ? '접기' : '펼치기'}
            />
          ) : null}
        </AccordionHeader>
        <FolderContent>{children}</FolderContent>
      </AccordionItem>
    </Accordion>
  );
}
