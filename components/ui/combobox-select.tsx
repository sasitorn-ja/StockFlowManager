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
  searchPlaceholder = "ค้นหา...",
  title,
  value,
}: ComboboxSelectProps) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const activeOption = options.find((option) => option.value === value);

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          title={title}
          className={cn("w-full justify-between", className)}
        >
          <span className="min-w-0 truncate">{activeOption?.label ?? placeholder}</span>
          <ChevronDown size={15} className="shrink-0 text-slate-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        portalled={false}
        className={cn("w-[--radix-popover-trigger-width] p-0", contentClassName)}
      >
        <Command>
          <CommandInput ref={inputRef} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
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
