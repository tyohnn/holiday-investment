/**
 * Pass-through. `/company` (the list) wraps itself in PlatformShell; the
 * `/company/[stockCode]/**` tree brings its own full-bleed Sidebar dashboard
 * shell (see [stockCode]/layout.tsx) instead of PlatformShell's padded,
 * max-width-constrained `<main>` — a fixed-position Sidebar needs to anchor
 * to the real viewport edge, not a centered container.
 */
export default function CompanyLayout({ children }: LayoutProps<'/company'>) {
  return <>{children}</>;
}
