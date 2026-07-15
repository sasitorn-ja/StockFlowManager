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
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
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
      <PopoverAnchor asChild>
        <div
          title={title}
          className={cn(
            "flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-[var(--panel)] px-4 text-left text-sm font-semibold text-slate-800 shadow-sm transition focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100",
            disabled && "cursor-not-allowed opacity-60",
            className
          )}
        >
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-disabled={disabled}
            value={open ? searchValue : activeOption?.label ?? ""}
            onChange={(event) => {
              if (!disabled) {
                setSearchValue(event.target.value);
                if (!open) {
                  setOpen(true);
                }
              }
            }}
            onFocus={() => {
              if (!disabled) {
                setOpen(true);
              }
            }}
            placeholder={open ? searchPlaceholder : placeholder}
            readOnly={disabled}
            className={cn(
              "min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400",
              !open && activeOption && "cursor-pointer"
            )}
          />
          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                setOpen((current) => !current);
              }
            }}
            className="shrink-0 text-slate-500"
            tabIndex={-1}
            aria-label="Toggle options"
          >
            <ChevronDown size={15} />
          </button>
        </div>
      </PopoverAnchor>
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
