import type { ReactNode } from 'react';
import { getManifest } from '@/lib/book/manifest';
import { INDUSTRIES } from '@/lib/industry';
import { listCompanyIndex } from '@/lib/platform/db';
import type { ChapterIndex, CompanyIndex, IndustryIndex } from '@/lib/platform/company-index';
import { AppSidebar } from '@/components/app-sidebar';
import { AppTopbar } from '@/components/app-topbar';
import { SymbolCommandProvider } from '@/components/symbol-command';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export const revalidate = 0;

async function loadCompanyIndex(): Promise<CompanyIndex[]> {
  try {
    return await listCompanyIndex();
  } catch (error) {
    console.warn('[app-shell] 종목 인덱스를 읽지 못했습니다', error);
    return [];
  }
}

async function loadChapters(): Promise<ChapterIndex[]> {
  try {
    const manifest = await getManifest();
    return manifest.books.flatMap((book) =>
      book.parts.flatMap((part) =>
        part.chapters.map((chapter) => ({
          href: `/book/${book.folder}/${chapter.slug}`,
          title: chapter.title,
          heading: chapter.heading,
          bookLabel: book.label,
        })),
      ),
    );
  } catch (error) {
    console.warn('[app-shell] 교재 목차를 읽지 못했습니다', error);
    return [];
  }
}

function industryIndex(): IndustryIndex[] {
  return INDUSTRIES.map((industry) => ({
    slug: industry.slug,
    name: industry.name,
    tagline: industry.tagline,
  }));
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [companies, chapters] = await Promise.all([loadCompanyIndex(), loadChapters()]);

  return (
    <SymbolCommandProvider companies={companies} industries={industryIndex()} chapters={chapters}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="h-svh overflow-hidden">
          <AppTopbar />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </SymbolCommandProvider>
  );
}
