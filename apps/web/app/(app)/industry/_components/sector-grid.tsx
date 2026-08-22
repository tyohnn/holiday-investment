import { KSIC_SECTIONS, ksicDivisionName } from '@investment/schema';
import type { DivisionCount } from '@/lib/platform/db';

export interface DivisionCoverage {
  /** 이 중분류에 종목이 들어와 있는 산업들 */
  industries: { slug: string; name: string; members: number }[];
}

/**
 * KSIC 중분류 격자 — 상장사 전수를 덮는 배경 지도.
 *
 * 이 격자는 **산업이 아니라 행정 분류**다. 한 칸이 곧 하나의 밸류체인이라는 뜻이 아니고,
 * 실제로 이차전지 28개사는 일곱 칸에 흩어져 있다. 그래서 칸에 붙는 배지는 "이 칸 = 그 산업"이
 * 아니라 "이 칸에 그 산업 종목이 N개 있다"로 읽어야 한다.
 */
export function SectorGrid({
  divisions,
  coverage,
}: {
  divisions: DivisionCount[];
  coverage: Map<string, DivisionCoverage>;
}) {
  const byDivision = new Map(divisions.map((d) => [d.division, d]));
  const max = divisions.reduce((m, d) => Math.max(m, d.total), 0);

  return (
    <div className="space-y-8">
      {KSIC_SECTIONS.map((section) => {
        const cells = section.divisions
          .map((d) => byDivision.get(d))
          .filter((d): d is DivisionCount => Boolean(d));
        // 상장사가 하나도 없는 중분류는 지도에서 뺀다 — 빈 칸이 많으면 실제 공백이 안 보인다.
        if (cells.length === 0) return null;
        const sectionTotal = cells.reduce((s, c) => s + c.total, 0);

        return (
          <section key={section.code}>
            <h3 className="mb-3 flex items-baseline gap-2 text-sm font-semibold">
              <span className="font-mono text-xs text-muted-foreground">{section.code}</span>
              {section.name}
              <span className="text-xs font-normal text-muted-foreground">
                {sectionTotal.toLocaleString()}개사
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {cells.map((cell) => {
                const covered = coverage.get(cell.division);
                return (
                  <div
                    key={cell.division}
                    className={`rounded-lg border p-3 ${
                      covered
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {cell.division}
                      </span>
                      <span className="text-xs font-medium tabular-nums">{cell.total}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug">
                      {ksicDivisionName(cell.division)}
                    </p>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={covered ? 'h-full bg-primary' : 'h-full bg-muted-foreground/40'}
                        style={{ width: `${max > 0 ? (cell.total / max) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      KOSPI {cell.kospi} · KOSDAQ {cell.kosdaq}
                    </p>
                    {covered && (
                      <ul className="mt-2 space-y-0.5">
                        {covered.industries.map((ind) => (
                          <li key={ind.slug} className="text-[10px] text-primary">
                            {ind.name} {ind.members}개사
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
