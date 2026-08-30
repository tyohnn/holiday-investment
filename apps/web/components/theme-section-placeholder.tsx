import { getTheme, getThemeSection, type ThemeId, type ThemeSectionId } from '@/lib/nav';

export function ThemeSectionPlaceholder({
  theme,
  section,
  note,
}: {
  theme: ThemeId;
  section: ThemeSectionId;
  note?: string;
}) {
  const themeMeta = getTheme(theme);
  const sectionMeta = getThemeSection(section);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">{themeMeta.label}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{sectionMeta.label}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {note ?? `${themeMeta.label} 테마의 ${sectionMeta.label} 화면은 아직 비어 있습니다.`}
      </p>
    </div>
  );
}
