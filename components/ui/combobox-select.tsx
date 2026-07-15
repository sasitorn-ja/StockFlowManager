"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxSelectOption = {
  value: string;
  label: string;
  keywords?: string;
};

type ComboboxSelectProps = {
  align?: "start" | "center" | "end";
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  emptyText?: string;
  onValueChange: (value: string) => void;
  options: ComboboxSelectOption[];
  placeholder?: string;
  portalled?: boolean;
  searchPlaceholder?: string;
  title?: string;
  value: string;
};

export function ComboboxSelect({
  align = "start",
  className,
  contentClassName,
  disabled = false,
  emptyText = "ไม่พบรายการที่ค้นหา",
  onValueChange,
  options,
  placeholder = "เลือกข้อมูล",
  portalled = true,
  searchPlaceholder = "ค้นหา...",
  title,
  value,
}: ComboboxSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const activeOption = options.find((option) => option.value === value);
  const normalizedQuery = searchValue.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) =>
        `${option.label} ${option.value} ${option.keywords || ""}`.toLowerCase().includes(normalizedQuery)
      )
    : options;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setSearchValue("");
    }
  }

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-disabled={disabled}
          title={title}
          className={cn(
            "flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-[var(--panel)] px-4 text-left text-sm font-semibold text-slate-800 shadow-sm transition focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100",
            disabled && "cursor-not-allowed opacity-60",
            className
          )}
          onClick={() => {
            if (!disabled && !open) {
              setOpen(true);
            }
          }}
        >
          {open && !disabled ? (
            <input
              ref={inputRef}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <span className={cn("min-w-0 truncate", !activeOption && "text-slate-400")}>
              {activeOption?.label ?? placeholder}
            </span>
          )}
          <ChevronDown size={15} className="shrink-0 text-slate-500" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        portalled={portalled}
        className={cn("w-[--radix-popover-trigger-width] max-w-[calc(100vw-1rem)] p-0", contentClassName)}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.keywords || option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    size={16}
                    className={cn("shrink-0", value === option.value ? "opacity-100" : "opacity-0")}
                  />
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
