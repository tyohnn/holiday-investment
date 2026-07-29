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

const folderButtonClassName = cn(
  'relative flex w-full flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0',
  'transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none',
  'data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary data-[active=true]:hover:transition-colors',
);

/**
 * Folder title click:
 * - collapsed → expand only (no navigation), so chapters are browsable first
 * - expanded + elsewhere → navigate to folder index
 * - expanded + already here → collapse
 * Chevron always toggles without navigating.
 */
function ExpandFirstFolderLink({
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
  if (!folder) throw new Error('ExpandFirstFolderLink must be used inside SidebarFolder');
  const { open, setOpen, collapsible } = folder;

  return (
    <Link
      ref={ref}
      href={href}
      external={external}
      data-active={active}
      prefetch={prefetch}
      className={folderButtonClassName}
      style={{ paddingInlineStart: itemOffset(depth - 1) }}
      onClick={(e) => {
        if (!collapsible) return;
        const onIcon =
          e.target instanceof Element &&
          e.target.matches('[data-icon], [data-icon] *');
        if (onIcon) {
          setOpen(!open);
          e.preventDefault();
          return;
        }
        if (!open) {
          setOpen(true);
          e.preventDefault();
          return;
        }
        if (active) {
          setOpen(false);
          e.preventDefault();
        }
      }}
    >
      {children}
      {collapsible ? (
        <ChevronDown
          data-icon
          className={cn(
            'ms-auto transition-transform',
            !open && '-rotate-90 rtl:rotate-90',
          )}
        />
      ) : null}
    </Link>
  );
}

function FolderTrigger({ children }: { children: ReactNode }) {
  const depth = useFolderDepth();
  return (
    <SidebarFolderTrigger
      className={folderButtonClassName}
      style={{ paddingInlineStart: itemOffset(depth - 1) }}
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
        <ExpandFirstFolderLink
          href={item.index.url}
          external={item.index.external}
          active={isExactActive(item.index.url, pathname)}
        >
          {item.icon}
          {item.name}
        </ExpandFirstFolderLink>
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
