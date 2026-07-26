import { formatFactDate, type TrackingFact } from '@investment/schema';

export function TrackingTimeline({ trackings }: { trackings: TrackingFact[] }) {
  if (trackings.length === 0) return null;

  const byTopic = new Map<string, TrackingFact[]>();
  for (const t of trackings) {
    const list = byTopic.get(t.topic) ?? [];
    list.push(t);
    byTopic.set(t.topic, list);
  }
  for (const list of byTopic.values()) {
    list.sort((a, b) => a.fact_date.localeCompare(b.fact_date));
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">사실 시계열</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[...byTopic.entries()].map(([topic, facts]) => (
          <div key={topic} className="rounded-xl border border-fd-border bg-fd-card p-4">
            <h3 className="flex items-center justify-between text-sm font-semibold">
              <span>{topic}</span>
              <span className="text-xs font-normal text-fd-muted-foreground">{facts.length}건</span>
            </h3>
            <ol className="mt-3 space-y-3 border-l border-fd-border pl-4">
              {facts.map((f) => (
                <li key={f.id} className="relative">
                  <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-fd-primary" />
                  <div className="text-xs text-fd-muted-foreground">
                    {formatFactDate(f.fact_date, f.date_precision)}
                  </div>
                  <div className="text-sm leading-relaxed">{f.fact}</div>
                  {f.value_text && (
                    <div className="mt-0.5 text-sm font-medium text-fd-foreground">{f.value_text}</div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-fd-muted-foreground">{f.source}</span>
                    {f.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-fd-secondary px-1.5 py-0.5 text-[10px] font-medium text-fd-secondary-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
