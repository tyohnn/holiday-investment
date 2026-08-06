import { TextbookChart } from '@/components/charts/textbook/textbook-chart';
import { cn } from '@/lib/cn';
import type { Block } from '@/lib/book/render';

/**
 * The reading surface: shadcn/typeset over compiled 교재 Markdown.
 *
 * Everything inside `.typeset` is styled by the stylesheet alone — the HTML
 * carries no classes. Charts are the exception: they're real React components,
 * so they get `not-typeset` (typeset must not restyle Recharts' internals) and
 * `book-bleed`, which lets them span past the text measure (see global.css).
 *
 * Each Markdown run is its own wrapper element rather than one big string
 * because charts sit between runs. typeset's "first child adds no space above"
 * rule is scoped to `.typeset > :first-child`, so only the opening paragraph
 * loses its top margin — the runs after a chart keep the normal flow spacing.
 *
 * `book-contents` makes this container `display: contents`, so the runs join
 * the surrounding `.book-flow` grid directly (see global.css). Pass it a
 * `book-flow` parent, or the bleed has nothing to bleed into.
 */
export function TypesetBody({
  blocks,
  className,
}: {
  blocks: Block[];
  className?: string;
}) {
  return (
    <div className={cn('typeset typeset-notes book-contents', className)}>
      {blocks.map((block, index) =>
        block.kind === 'chart' ? (
          <div key={`chart-${block.id}-${index}`} className="book-bleed not-typeset">
            <TextbookChart id={block.id} />
          </div>
        ) : (
          <div
            key={`html-${index}`}
            // Authored 교재 Markdown compiled at build time — not user input.
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        ),
      )}
    </div>
  );
}
