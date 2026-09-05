'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CaretDownIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type PathComboboxItem = {
  value: string;
  label: string;
  href: string;
  hint?: string;
};

export type PathComboboxGroup = {
  heading?: string;
  items: PathComboboxItem[];
};

export function PathCombobox({
  value,
  label,
  groups,
  placeholder = '검색',
  empty = '결과 없음',
  className,
}: {
  value: string;
  label: string;
  groups: PathComboboxGroup[];
  placeholder?: string;
  empty?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          className={cn('h-8 max-w-[14rem] gap-1 px-2 text-sm font-medium', className)}
        >
          <span className="truncate">{label}</span>
          <CaretDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>{empty}</CommandEmpty>
            {groups.map((group, index) => (
              <CommandGroup key={group.heading ?? String(index)} heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={`${item.label} ${item.hint ?? ''} ${item.value}`}
                    onSelect={() => go(item.href)}
                    data-checked={item.value === value || undefined}
                  >
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate">{item.label}</span>
                      {item.hint && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {item.hint}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
