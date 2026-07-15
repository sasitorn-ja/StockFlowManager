"use client";

import { ComboboxInput, type ComboboxInputOption } from "@/components/ui/combobox-input";

export type ComboboxSelectOption = ComboboxInputOption & {
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
  emptyText,
  onValueChange,
  options,
  placeholder,
  portalled,
  searchPlaceholder,
  value,
}: ComboboxSelectProps) {
  return (
    <ComboboxInput
      className={className}
      disabled={disabled}
      emptyText={emptyText}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      portalled={portalled}
      searchPlaceholder={searchPlaceholder}
      value={value}
      allowCustomValue={false}
    />
  );
}
