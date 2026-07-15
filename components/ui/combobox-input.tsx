"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxInputOption = {
  label: string;
  value: string;
};

type ComboboxInputProps = {
  allowCustomValue?: boolean;
  className?: string;
  disabled?: boolean;
  emptyText?: string;
  onValueChange: (value: string) => void;
  options: ComboboxInputOption[];
  placeholder?: string;
  portalled?: boolean;
  searchPlaceholder?: string;
  value: string;
};

export function ComboboxInput({
  allowCustomValue = true,
  className,
  disabled = false,
  emptyText = "ไม่พบรายการที่ค้นหา",
  onValueChange,
  options,
  placeholder = "เลือกหรือพิมพ์ข้อมูล",
  portalled = true,
  searchPlaceholder = "ค้นหาหรือพิมพ์ค่าใหม่...",
  value,
}: ComboboxInputProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const activeOption = options.find((option) => option.value === value);
  const trimmedSearchValue = searchValue.trim();
  const hasExactOption = options.some(
    (option) => option.value.trim().toLowerCase() === trimmedSearchValue.toLowerCase()
  );

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
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <span className={cn("min-w-0 truncate", !value && "text-slate-400")}>
            {(activeOption?.label ?? value) || placeholder}
          </span>
          <ChevronDown size={15} className="shrink-0 text-slate-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        portalled={portalled}
        className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-1rem)] p-0"
      >
        <Command shouldFilter>
          <CommandInput
            ref={inputRef}
            value={searchValue}
            onValueChange={(nextValue) => {
              setSearchValue(nextValue);
              if (allowCustomValue) {
                onValueChange(nextValue);
              }
            }}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>
              {allowCustomValue && searchValue.trim()
                ? `ใช้ค่า “${searchValue.trim()}”`
                : emptyText}
            </CommandEmpty>
            <CommandGroup>
              {allowCustomValue && trimmedSearchValue && !hasExactOption ? (
                <CommandItem
                  value={`__custom__ ${trimmedSearchValue}`}
                  onSelect={() => {
                    onValueChange(trimmedSearchValue);
                    setOpen(false);
                  }}
                >
                  <Check size={16} className="shrink-0 opacity-0" />
                  <span className="truncate">ใช้ค่า “{trimmedSearchValue}”</span>
                </CommandItem>
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={`${option.value}-${option.label}`}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    size={16}
                    className={cn("shrink-0", value === option.value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
