import type { CorrectionChain } from '@investment/schema';
import { formatKoDate, dartUrl } from './format';

function daysBadgeClass(days: number | null): string {
  if (days === null) return 'bg-secondary text-secondary-foreground';
  if (days >= 90) return 'bg-red-500/15 text-red-600 dark:text-red-400';
  if (days >= 30) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
}

export function CorrectionChains({ corrections }: { corrections: CorrectionChain[] }) {
  if (corrections.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold">기재정정 체인</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        정정본 → 원본 연결. 시차가 클수록 최초 공시의 신뢰도가 낮았다는 신호입니다.
      </p>
      <ul className="mt-3 space-y-2">
        {corrections.map((c) => (
          <li
            key={c.correction_rcept_no}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{c.base_report_nm}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <a href={dartUrl(c.correction_rcept_no)} target="_blank" rel="noreferrer" className="hover:underline">
                  정정본 {formatKoDate(c.correction_dt)}
                </a>
                <span>←</span>
                {c.original_rcept_no ? (
                  <a href={dartUrl(c.original_rcept_no)} target="_blank" rel="noreferrer" className="hover:underline">
                    원본 {formatKoDate(c.original_dt)}
                  </a>
                ) : (
                  <span>원본 미상</span>
                )}
              </div>
            </div>
            <span
              className={`shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-semibold sm:self-center ${daysBadgeClass(
                c.days_after_original,
              )}`}
            >
              {c.days_after_original === null ? '시차 미상' : `${c.days_after_original}일 후 정정`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
