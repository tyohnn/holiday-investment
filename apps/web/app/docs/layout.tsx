import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { DocsSidebarFolder } from '@/components/docs-sidebar-folder';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      sidebar={{
        components: {
          Folder: DocsSidebarFolder,
        },
      }}
    >
      {children}
    </DocsLayout>
  );
}
