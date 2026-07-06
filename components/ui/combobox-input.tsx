"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

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
  searchPlaceholder = "ค้นหาหรือพิมพ์ค่าใหม่...",
  value,
}: ComboboxInputProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const activeOption = options.find((option) => option.value === value);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setSearchValue("");
    }
  }

  return (
    <Popover modal open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("min-w-0 truncate", !value && "text-slate-400")}>
            {(activeOption?.label ?? value) || placeholder}
          </span>
          <ChevronsUpDown size={15} className="shrink-0 text-slate-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter>
          <CommandInput
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
