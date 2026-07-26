import { fieldSpec, formatFieldValue, type DartEvent } from '@investment/schema';
import { formatKoDate, dartUrl } from './format';

/** 페이지 다른 곳에 이미 노출되는 값(회사 식별 정보·링크 소스)만 카드 그리드에서 제외한다.
 *  라벨 사전 커버리지와 무관 — 값 자체가 이 페이지에서 중복 표시될 뿐 정보가 사라지지 않는다. */
const REDUNDANT_KEYS = new Set(['corp_code', 'corp_name', 'stock_code', 'corp_cls', 'rcept_no', 'rcept_dt']);

export function EventsSection({ events }: { events: DartEvent[] }) {
  if (events.length === 0) return null;

  const byType = new Map<string, DartEvent[]>();
  for (const e of events) {
    const list = byType.get(e.event_type) ?? [];
    list.push(e);
    byType.set(e.event_type, list);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">주요사항 이벤트</h2>
      <div className="mt-3 space-y-6">
        {[...byType.entries()].map(([eventType, list]) => (
          <div key={eventType}>
            <h3 className="text-sm font-semibold">
              {eventType}
              <span className="ml-2 text-xs font-normal text-fd-muted-foreground">{list.length}건</span>
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {list.map((e) => {
                const entries = Object.entries(e.payload).filter(([key, value]) => {
                  if (REDUNDANT_KEYS.has(key)) return false;
                  return value !== null && value !== undefined && value !== '' && value !== '-';
                });
                return (
                  <div key={e.id} className="rounded-xl border border-fd-border bg-fd-card p-4">
                    <div className="flex items-center justify-between text-xs text-fd-muted-foreground">
                      <span>{formatKoDate(e.rcept_dt)}</span>
                      {e.rcept_no && (
                        <a href={dartUrl(e.rcept_no)} target="_blank" rel="noreferrer" className="hover:underline">
                          DART 원문 ↗
                        </a>
                      )}
                    </div>
                    {entries.length === 0 ? (
                      <p className="mt-2 text-xs text-fd-muted-foreground">세부 항목 없음</p>
                    ) : (
                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                        {entries.map(([key, value]) => {
                          const spec = fieldSpec('event', eventType, key);
                          return (
                            <div key={key} className="min-w-0">
                              <dt className="truncate text-xs text-fd-muted-foreground" title={key}>
                                {spec.label}
                              </dt>
                              <dd className="truncate font-medium" title={String(value)}>
                                {formatFieldValue(value, spec.unit)}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
