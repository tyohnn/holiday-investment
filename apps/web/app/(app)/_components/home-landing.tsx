'use client';

import Link from 'next/link';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { labHref } from '@/lib/platform/company-index';
import {
  ShortcutHint,
  SymbolCommandTrigger,
  SymbolRow,
  useSymbolCommand,
} from '@/components/symbol-command';

export function HomeLanding() {
  const { companies, recentCodes, remember } = useSymbolCommand();
  const recent = recentCodes
    .map((code) => companies.find((company) => company.stock_code === code))
    .filter((company): company is NonNullable<typeof company> => Boolean(company));

  return (
    <div className="mx-auto w-full max-w-2xl pt-4">
      <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">종목 분석</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance break-keep">
        종목을 검색해 분석을 시작합니다
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        이름이나 종목코드로 찾고, 분석 단계는 그대로 둔 채 종목만 바꿉니다.
      </p>

      <SymbolCommandTrigger
        type="button"
        className="mt-8 flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-[var(--shadow-card)] transition-colors hover:border-primary/50 hover:bg-accent/40"
      >
        <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm text-muted-foreground">종목명, 종목코드</span>
        <ShortcutHint />
      </SymbolCommandTrigger>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">최근</h2>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
            {recent.map((company) => (
              <li key={company.stock_code}>
                <Link
                  href={labHref(company.stock_code)}
                  onClick={() => remember(company.stock_code)}
                  className="flex items-center px-3 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <SymbolRow company={company} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          적재된 종목
        </h2>
        {companies.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            적재된 종목이 없습니다. 로컬 Supabase를 켜면 시드 종목이 여기에 나타납니다.
          </p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
              {companies.slice(0, 20).map((company) => (
                <li key={company.stock_code}>
                  <Link
                    href={labHref(company.stock_code)}
                    onClick={() => remember(company.stock_code)}
                    className="flex items-center px-3 py-2.5 transition-colors hover:bg-accent/50"
                  >
                    <SymbolRow company={company} />
                  </Link>
                </li>
              ))}
            </ul>
            {companies.length > 20 && (
              <SymbolCommandTrigger
                type="button"
                className="mt-2 w-full rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
              >
                나머지 {companies.length - 20}개 종목 검색
              </SymbolCommandTrigger>
            )}
          </>
        )}
      </section>
    </div>
  );
}
