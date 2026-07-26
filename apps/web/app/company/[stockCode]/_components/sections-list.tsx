import Link from 'next/link';
import type { NoteSectionListItem } from '@/lib/platform/db';
import { formatKoDate } from './format';

/** 주석(★)·사업의 내용(☆) 섹션 목록 — 사업보고서 원문은 길어서(A1: 4천~5천 줄) 전문을
 *  이 페이지에 얹지 않는다. 항목을 눌러 개별 섹션 상세로 들어가서 읽는다. */
export function SectionsList({
  stockCode,
  sections,
}: {
  stockCode: string;
  sections: NoteSectionListItem[];
}) {
  if (sections.length === 0) return null;

  const byFiling = new Map<string, NoteSectionListItem[]>();
  for (const s of sections) {
    const list = byFiling.get(s.rcept_no) ?? [];
    list.push(s);
    byFiling.set(s.rcept_no, list);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">사업보고서 주석·사업의 내용</h2>
      <p className="mt-1 text-xs text-fd-muted-foreground">
        ★주석 · ☆사업의 내용 — 수치 인용 전 원문 대조 원칙 (표 서식 일부 손실 가능)
      </p>
      <div className="mt-3 space-y-3">
        {[...byFiling.entries()].map(([rceptNo, items]) => (
          <div key={rceptNo} className="rounded-xl border border-fd-border bg-fd-card p-4">
            <div className="text-sm font-medium">
              {items[0].report_nm}{' '}
              <span className="font-normal text-fd-muted-foreground">
                ({formatKoDate(items[0].filing_rcept_dt)})
              </span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {items.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/company/${stockCode}/filing/${rceptNo}/${s.sec_no}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-fd-border px-2.5 py-1 text-sm hover:bg-fd-accent/40"
                  >
                    {s.is_note && <span className="text-amber-500">★</span>}
                    {s.is_biz && <span className="text-sky-500">☆</span>}
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
