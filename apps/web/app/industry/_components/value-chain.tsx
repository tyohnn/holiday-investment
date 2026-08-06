import Link from 'next/link';
import type { ChainMember, ValueChainStage } from '@/lib/industry';
import type { MemberFinancials } from '@/lib/platform/db';
import { VerdictBadge } from './verdict';

/** 종목코드 → 그 회사의 연간 재무. 카탈로그에 숫자를 적지 않으므로 화면에서 붙인다. */
export type MemberFacts = Map<string, { fsDiv: string | null; rows: MemberFinancials[] }>;

const AXIS_LABEL = {
  material: '물질 축 — 광물에서 완성차까지 흐른다',
  equipment: '장비 축 — 그 흐름을 가능하게 한다',
  holding: '지주·기타 — 체인 위에 얹힌 지배구조',
} as const;

const PRICING_LABEL = {
  metal: '금속가 연동',
  volume: '물량만 움직임',
} as const;

export function ValueChain({
  stages,
  facts,
  year,
}: {
  stages: ValueChainStage[];
  facts: MemberFacts;
  year: number;
}) {
  const axes = (['material', 'equipment', 'holding'] as const).filter((axis) =>
    stages.some((s) => s.axis === axis),
  );

  return (
    <div className="space-y-10">
      {axes.map((axis) => {
        const axisStages = stages.filter((s) => s.axis === axis);
        return (
          <section key={axis}>
            <h3 className="text-sm font-semibold">{AXIS_LABEL[axis]}</h3>
            {/* 가로 스크롤은 이 컨테이너 안에서만 일어난다 — 본문이 옆으로 밀리면 안 된다. */}
            <div className="mt-3 overflow-x-auto pb-2">
              <ol className="flex min-w-max items-stretch gap-2">
                {axisStages.map((stage, i) => (
                  <li key={stage.id} className="flex items-stretch gap-2">
                    <StageCard stage={stage} facts={facts} year={year} />
                    {axis === 'material' && i < axisStages.length - 1 && (
                      <div
                        aria-hidden
                        className="flex w-4 shrink-0 items-center justify-center text-fd-muted-foreground"
                      >
                        →
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StageCard({
  stage,
  facts,
  year,
}: {
  stage: ValueChainStage;
  facts: MemberFacts;
  year: number;
}) {
  return (
    <article className="flex w-72 shrink-0 flex-col rounded-xl border border-fd-border bg-fd-card p-4">
      <header>
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-snug">{stage.name}</h4>
          {stage.capexShare !== undefined && (
            <span className="shrink-0 rounded-md bg-fd-secondary px-1.5 py-0.5 text-[10px] font-medium text-fd-secondary-foreground">
              투자비중 {stage.capexShare}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-snug text-fd-muted-foreground">{stage.role}</p>
      </header>

      {(stage.downturnRank || stage.recoveryRank || stage.pricing) && (
        <dl className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-fd-muted/50 p-2 text-[10px]">
          <div>
            <dt className="text-fd-muted-foreground">침체 악화</dt>
            <dd className="font-medium tabular-nums">
              {stage.downturnRank ? `${stage.downturnRank}위` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-fd-muted-foreground">회복 순서</dt>
            <dd className="font-medium tabular-nums">
              {stage.recoveryRank ? `${stage.recoveryRank}번째` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-fd-muted-foreground">판매가</dt>
            <dd className="font-medium">{stage.pricing ? PRICING_LABEL[stage.pricing] : '—'}</dd>
          </div>
        </dl>
      )}

      {stage.note && (
        <p className="mt-2 text-[11px] leading-relaxed text-fd-muted-foreground">{stage.note}</p>
      )}

      <ul className="mt-3 flex-1 space-y-2">
        {stage.members.map((member) => (
          <MemberRow key={member.name} member={member} facts={facts} year={year} />
        ))}
      </ul>
    </article>
  );
}

function MemberRow({
  member,
  facts,
  year,
}: {
  member: ChainMember;
  facts: MemberFacts;
  year: number;
}) {
  const fact = member.stockCode ? facts.get(member.stockCode) : undefined;
  const row = fact?.rows.find((r) => r.bsns_year === year);

  return (
    <li className="rounded-lg border border-fd-border/70 px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {member.stockCode ? (
            <Link
              href={`/company/${member.stockCode}`}
              className="text-xs font-medium text-fd-primary underline-offset-2 hover:underline"
            >
              {member.name}
            </Link>
          ) : (
            <span className="text-xs font-medium">{member.name}</span>
          )}
          {member.role && (
            <span className="ml-1.5 text-[10px] text-fd-muted-foreground">{member.role}</span>
          )}
        </div>
        {member.verdict && <VerdictBadge verdict={member.verdict} />}
      </div>

      {row && (
        <p className="mt-1 flex flex-wrap gap-x-2 text-[10px] tabular-nums text-fd-muted-foreground">
          <span>
            {year} 매출 {formatEok(row.revenue)}
          </span>
          <span>이익률 {row.opm_pct === null ? '—' : `${row.opm_pct.toFixed(1)}%`}</span>
          {row.fs_div === 'OFS' && <span className="text-amber-700 dark:text-amber-300">별도</span>}
        </p>
      )}
      {member.stockCode && !row && (
        <p className="mt-1 text-[10px] text-fd-muted-foreground">{year} 재무 미보유</p>
      )}

      {member.conglomerate && (
        <p className="mt-1 text-[10px] leading-snug text-amber-700 dark:text-amber-300">
          그룹 전체 수치다 — 이 산업 부문만 분리되지 않는다
        </p>
      )}
      {member.verdictNote && (
        <p className="mt-1 text-[10px] leading-snug text-fd-muted-foreground">
          {member.verdictNote}
        </p>
      )}
    </li>
  );
}

/** fin_periods 의 금액은 원 단위다. 리서치 산출물이 억 단위라 표기를 맞춘다. */
function formatEok(won: number | null): string {
  if (won === null) return '—';
  const eok = won / 100_000_000;
  if (Math.abs(eok) >= 10_000) return `${(eok / 10_000).toFixed(1)}조`;
  return `${Math.round(eok).toLocaleString()}억`;
}
