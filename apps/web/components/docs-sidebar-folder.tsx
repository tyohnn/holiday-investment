'use client';

import type { ReactNode } from 'react';
import type { Folder } from 'fumadocs-core/page-tree';
import Link from 'fumadocs-core/link';
import { usePathname } from 'fumadocs-core/framework';
import { useTreePath } from 'fumadocs-ui/contexts/tree';
import {
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderTrigger,
  useAutoScroll,
  useFolder,
  useFolderDepth,
  useSidebar,
} from 'fumadocs-ui/components/sidebar/base';
import { ChevronDown } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/lib/cn';

function normalize(url: string) {
  return url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url;
}

function isExactActive(href: string, pathname: string) {
  return normalize(href) === normalize(pathname);
}

function itemOffset(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

const rowClassName = cn(
  'group relative flex w-full flex-row items-stretch rounded-lg text-fd-muted-foreground',
  'transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80',
  'has-[[data-active=true]]:bg-fd-primary/10 has-[[data-active=true]]:text-fd-primary',
);

const titleClassName = cn(
  'flex min-w-0 flex-1 items-center gap-2 rounded-lg p-2 pe-1 text-start wrap-anywhere',
  '[&_svg]:size-4 [&_svg]:shrink-0',
);

const chevronButtonClassName = cn(
  'inline-flex shrink-0 items-center justify-center rounded-md px-1.5 text-fd-muted-foreground',
  'transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring',
);

/**
 * Split control:
 * - title area → navigates to folder index
 * - chevron button → expand / collapse only
 */
function SplitFolderControl({
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
  const depth = useFolderDepth();
  const folder = useFolder();
  const { prefetch } = useSidebar();
  useAutoScroll(active, ref);
  if (!folder) throw new Error('SplitFolderControl must be used inside SidebarFolder');
  const { open, setOpen, collapsible } = folder;

  return (
    <div
      className={rowClassName}
      style={{ paddingInlineStart: itemOffset(Math.max(depth - 1, 0)) }}
    >
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
      {collapsible ? (
        <button
          type="button"
          aria-label={open ? '접기' : '펼치기'}
          aria-expanded={open}
          className={chevronButtonClassName}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown
            className={cn(
              'size-4 transition-transform',
              !open && '-rotate-90 rtl:rotate-90',
            )}
          />
        </button>
      ) : null}
    </div>
  );
}

function FolderTrigger({ children }: { children: ReactNode }) {
  const depth = useFolderDepth();
  return (
    <SidebarFolderTrigger
      className={cn(rowClassName, titleClassName, 'w-full p-2')}
      style={{ paddingInlineStart: itemOffset(Math.max(depth - 1, 0)) }}
    >
      {children}
    </SidebarFolderTrigger>
  );
}

function FolderContent({ children }: { children: ReactNode }) {
  const depth = useFolderDepth();
  return (
    <SidebarFolderContent
      className={cn(
        'relative',
        depth === 1 &&
          "before:absolute before:inset-y-1 before:inset-s-2.5 before:w-px before:bg-fd-border before:content-['']",
      )}
    >
      <div className="flex flex-col gap-0.5 pt-0.5">{children}</div>
    </SidebarFolderContent>
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

  return (
    <SidebarFolder
      collapsible={item.collapsible}
      defaultOpen={item.defaultOpen}
      active={inPath}
    >
      {item.index ? (
        <SplitFolderControl
          href={item.index.url}
          external={item.index.external}
          active={isExactActive(item.index.url, pathname)}
        >
          {item.icon}
          {item.name}
        </SplitFolderControl>
      ) : (
        <FolderTrigger>
          {item.icon}
          {item.name}
        </FolderTrigger>
      )}
      <FolderContent>{children}</FolderContent>
    </SidebarFolder>
  );
}
