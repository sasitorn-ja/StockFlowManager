"use client";

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

type IssueTypeOption = {
  keywords?: string;
  triggerLabel?: string;
  value: string;
  label: string;
};

type IssueTypeComboboxProps = {
  disabled?: boolean;
  emptyText?: string;
  label: string;
  onValueChange: (value: string) => void;
  open: boolean;
  options: IssueTypeOption[];
  placeholder: string;
  searchPlaceholder: string;
  setOpen: (open: boolean) => void;
  value: string;
};

export function IssueTypeCombobox({
  disabled = false,
  emptyText = "ไม่พบรายการที่ค้นหา",
  label,
  onValueChange,
  open,
  options,
  placeholder,
  searchPlaceholder,
  setOpen,
  value,
}: IssueTypeComboboxProps) {
  const activeOption = options.find((option) => option.value === value);

  return (
    <div className="issue-type-filter">
      <span>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
            className="issue-type-filter-button"
          >
            <span className="truncate">{activeOption?.triggerLabel ?? activeOption?.label ?? placeholder}</span>
            <ChevronDown size={15} className="shrink-0 text-slate-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[264px] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
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
    </div>
  );
}
