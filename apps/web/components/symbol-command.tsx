'use client';

import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpenTextIcon, GlobeHemisphereEastIcon, XIcon } from '@phosphor-icons/react';
import {
  companyMetaLine,
  labHref,
  matchesChapter,
  matchesCompany,
  matchesIndustry,
  parseLabPath,
  type ChapterIndex,
  type CompanyIndex,
  type IndustryIndex,
  type MarketChip,
} from '@/lib/platform/company-index';
import { cn } from '@/lib/cn';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

const RECENT_KEY = 'symbol-command:recent';
const RECENT_MAX = 8;

const CHIPS: { id: MarketChip; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'KOSPI', label: '코스피' },
  { id: 'KOSDAQ', label: '코스닥' },
  { id: 'recent', label: '최근' },
];

type SymbolCommandValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  companies: CompanyIndex[];
  industries: IndustryIndex[];
  chapters: ChapterIndex[];
  recentCodes: string[];
  remember: (stockCode: string) => void;
};

const SymbolCommandContext = createContext<SymbolCommandValue | null>(null);

export function useSymbolCommand(): SymbolCommandValue {
  const ctx = useContext(SymbolCommandContext);
  if (!ctx) throw new Error('useSymbolCommand must be used within SymbolCommandProvider');
  return ctx;
}

type TriggerProps = ComponentProps<'button'> & { asChild?: boolean };

export function SymbolCommandTrigger({
  asChild,
  children,
  onClick,
  ...props
}: TriggerProps) {
  const { setOpen } = useSymbolCommand();

  function openPalette(event: MouseEvent<HTMLElement>) {
    onClick?.(event as MouseEvent<HTMLButtonElement>);
    if (!event.defaultPrevented) setOpen(true);
  }

  if (asChild) {
    if (!isValidElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>(children)) {
      return null;
    }
    return cloneElement(children, {
      ...props,
      onClick: (event: MouseEvent<HTMLElement>) => {
        children.props.onClick?.(event);
        openPalette(event);
      },
    });
  }

  return (
    <button type="button" data-symbol-command-trigger="" onClick={openPalette} {...props}>
      {children}
    </button>
  );
}

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((code): code is string => typeof code === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecent(codes: string[]) {
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(codes.slice(0, RECENT_MAX)));
}

export function SymbolRow({
  company,
  dense = false,
}: {
  company: CompanyIndex;
  dense?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground',
          dense ? 'size-6 text-[11px]' : 'size-8 text-xs',
        )}
      >
        {company.name.slice(0, 1)}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className={cn('truncate font-semibold', dense ? 'text-sm' : 'text-[15px]')}>
            {company.name}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{company.stock_code}</span>
        </span>
        <span className="truncate text-[11px] text-muted-foreground">{companyMetaLine(company)}</span>
      </span>
    </span>
  );
}

export function ShortcutHint() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes('Mac'));
  }, []);
  return (
    <KbdGroup>
      <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  );
}

export function SymbolCommandProvider({
  companies,
  industries,
  chapters,
  children,
}: {
  companies: CompanyIndex[];
  industries: IndustryIndex[];
  chapters: ChapterIndex[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [recentCodes, setRecentCodes] = useState<string[]>([]);

  useEffect(() => {
    setRecentCodes(readRecent());
  }, []);

  const remember = useCallback((stockCode: string) => {
    setRecentCodes((prev) => {
      const next = [stockCode, ...prev.filter((code) => code !== stockCode)].slice(0, RECENT_MAX);
      writeRecent(next);
      return next;
    });
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo<SymbolCommandValue>(
    () => ({ open, setOpen, companies, industries, chapters, recentCodes, remember }),
    [open, companies, industries, chapters, recentCodes, remember],
  );

  return (
    <SymbolCommandContext.Provider value={value}>
      {children}
      <SymbolCommandDialog />
    </SymbolCommandContext.Provider>
  );
}

function SymbolCommandDialog() {
  const { open, setOpen, companies, industries, chapters, recentCodes, remember } = useSymbolCommand();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<MarketChip>('all');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setChip('all');
    }
  }, [open]);

  const { boardSlug } = parseLabPath(pathname);
  const recentCompanies = recentCodes
    .map((code) => companies.find((company) => company.stock_code === code))
    .filter((company): company is CompanyIndex => Boolean(company));

  const filteredCompanies = useMemo(() => {
    const base =
      chip === 'recent'
        ? recentCompanies
        : chip === 'all'
          ? companies
          : companies.filter((company) => company.market === chip);
    return base.filter((company) => matchesCompany(company, query));
  }, [chip, companies, query, recentCompanies]);

  const listedCompanies = query.trim().length >= 1 ? filteredCompanies.slice(0, 80) : filteredCompanies.slice(0, 24);

  const showExtras = chip === 'all' || query.trim().length > 0;
  const filteredIndustries = showExtras ? industries.filter((item) => matchesIndustry(item, query)).slice(0, 12) : [];
  const filteredChapters = showExtras ? chapters.filter((item) => matchesChapter(item, query)).slice(0, 12) : [];

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  function goCompany(stockCode: string) {
    remember(stockCode);
    setOpen(false);
    router.push(labHref(stockCode, boardSlug));
  }

  function goHref(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200]" role="presentation">
      <button
        type="button"
        aria-label="검색 닫기"
        className="absolute inset-0 bg-black/80"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="symbol-command-title"
        className="absolute top-[18%] left-1/2 z-[201] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
      >
        <h2 id="symbol-command-title" className="sr-only">
          종목 검색
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 z-[1]"
          onClick={() => setOpen(false)}
        >
          <XIcon />
          <span className="sr-only">닫기</span>
        </Button>
        <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="종목명, 종목코드"
          autoFocus
        />
        <div className="flex flex-wrap gap-1 px-2 pt-2">
          {CHIPS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setChip(item.id)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                chip === item.id
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <CommandList className="max-h-[min(28rem,55vh)]">
          <CommandEmpty>검색 결과 없음</CommandEmpty>
          {chip !== 'recent' && recentCompanies.length > 0 && query.trim() === '' && (
            <CommandGroup heading="최근">
              {recentCompanies.map((company) => (
                <CommandItem
                  key={`recent-${company.stock_code}`}
                  value={`recent:${company.stock_code}`}
                  onSelect={() => goCompany(company.stock_code)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    goCompany(company.stock_code);
                  }}
                >
                  <SymbolRow company={company} dense />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {listedCompanies.length > 0 && (
            <CommandGroup heading={chip === 'recent' ? '최근' : '종목'}>
              {listedCompanies.map((company) => (
                <CommandItem
                  key={`company-${company.stock_code}`}
                  value={`company:${company.stock_code}`}
                  onSelect={() => goCompany(company.stock_code)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    goCompany(company.stock_code);
                  }}
                >
                  <SymbolRow company={company} dense />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {filteredIndustries.length > 0 && (
            <CommandGroup heading="산업">
              {filteredIndustries.map((industry) => (
                <CommandItem
                  key={`industry-${industry.slug}`}
                  value={`industry:${industry.slug}`}
                  onSelect={() => goHref(`/industry/${encodeURIComponent(industry.slug)}`)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    goHref(`/industry/${encodeURIComponent(industry.slug)}`);
                  }}
                >
                  <GlobeHemisphereEastIcon className="size-4 text-muted-foreground" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate font-medium">{industry.name}</span>
                    <span className="truncate text-[11px] text-muted-foreground">{industry.tagline}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {filteredChapters.length > 0 && (
            <CommandGroup heading="교재">
              {filteredChapters.map((chapter) => (
                <CommandItem
                  key={chapter.href}
                  value={`chapter:${chapter.href}`}
                  onSelect={() => goHref(chapter.href)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    goHref(chapter.href);
                  }}
                >
                  <BookOpenTextIcon className="size-4 text-muted-foreground" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate font-medium">{chapter.heading}</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {chapter.bookLabel} · {chapter.title}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
      </div>
    </div>
  );
}
