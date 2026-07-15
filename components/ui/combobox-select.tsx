"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

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
  className,
  disabled = false,
  onValueChange,
  options,
  placeholder = "เลือกข้อมูล",
  title,
  value,
}: ComboboxSelectProps) {
  const hasValue = options.some((option) => option.value === value);

  return (
    <div className="relative">
      <select
        value={hasValue ? value : ""}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        title={title}
        className={cn(
          "h-12 w-full appearance-none rounded-xl border border-slate-200 bg-[var(--panel)] px-4 pr-11 text-left text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60",
          !hasValue && "text-slate-400",
          className
        )}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
      />
    </div>
  );
}
