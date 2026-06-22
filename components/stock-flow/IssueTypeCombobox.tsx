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
  value: string;
  label: string;
};

type IssueTypeComboboxProps = {
  onValueChange: (value: string) => void;
  open: boolean;
  options: IssueTypeOption[];
  setOpen: (open: boolean) => void;
  value: string;
};

export function IssueTypeCombobox({
  onValueChange,
  open,
  options,
  setOpen,
  value,
}: IssueTypeComboboxProps) {
  const activeOption = options.find((option) => option.value === value);

  return (
    <div className="issue-type-filter">
      <span>ตัวกรองประเภทสินค้า</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="issue-type-filter-button"
          >
            <span>{activeOption?.label ?? "ประเภทสินค้า"}</span>
            <ChevronDown size={15} className="shrink-0 text-slate-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[264px] p-0">
          <Command>
            <CommandInput placeholder="ค้นหาประเภทสินค้า..." />
            <CommandList>
              <CommandEmpty>ไม่พบประเภทสินค้าที่ค้นหา</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
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
