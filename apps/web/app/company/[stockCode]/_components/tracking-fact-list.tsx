import { formatFactDate, type TrackingFact } from '@investment/schema';

export function filterTrackingsByTopics(
  trackings: TrackingFact[],
  topics: string[] | undefined,
): TrackingFact[] {
  if (!topics?.length) return [];
  const set = new Set(topics);
  return trackings
    .filter((t) => set.has(t.topic) || topics.some((topic) => t.topic.includes(topic)))
    .sort((a, b) => a.fact_date.localeCompare(b.fact_date));
}

export function TrackingFactList({
  facts,
  limit = 8,
}: {
  facts: TrackingFact[];
  limit?: number;
}) {
  const shown = facts.slice(-limit);
  if (shown.length === 0) return null;

  return (
    <ol className="space-y-2.5 border-l border-fd-border pl-3">
      {shown.map((f) => (
        <li key={f.id} className="relative text-sm">
          <span className="absolute -left-[15px] top-1.5 h-1.5 w-1.5 rounded-full bg-fd-primary" />
          <div className="text-[11px] text-fd-muted-foreground">
            {formatFactDate(f.fact_date, f.date_precision)}
            <span className="mx-1 opacity-40">·</span>
            {f.topic}
          </div>
          <div className="leading-snug">{f.fact}</div>
          {f.value_text && (
            <div className="mt-0.5 text-xs font-medium tabular-nums">{f.value_text}</div>
          )}
        </li>
      ))}
    </ol>
  );
}
