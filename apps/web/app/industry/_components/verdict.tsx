import type { Verdict } from '@/lib/industry';

/** 채(sieve) 판정 색. widget-shell 의 TRUST_CLASS 와 같은 톤을 쓴다. */
export const VERDICT_CLASS: Record<Verdict, string> = {
  통과: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  통과철회: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  판정보류: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  실패: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  범위밖: 'bg-muted text-muted-foreground',
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${VERDICT_CLASS[verdict]}`}
    >
      {verdict}
    </span>
  );
}
