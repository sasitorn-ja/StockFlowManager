"use client";

import * as React from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput as BaseComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export type ComboboxInputOption = {
  label: string;
  value: string;
};

type ComboboxInputProps = {
  allowCustomValue?: boolean;
  className?: string;
  disabled?: boolean;
  emptyText?: string;
  onOpenChange?: (open: boolean) => void;
  onValueChange: (value: string) => void;
  open?: boolean;
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
  onOpenChange,
  onValueChange,
  open: controlledOpen,
  options,
  placeholder = "เลือกหรือพิมพ์ข้อมูล",
  portalled = true,
  searchPlaceholder,
  value,
}: ComboboxInputProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const activeOption = options.find((option) => option.value === value);
  const displayValue = activeOption?.label ?? value;
  const [inputValue, setInputValue] = React.useState(displayValue);
  const open = controlledOpen ?? uncontrolledOpen;
  const optionLabels = React.useMemo(() => options.map((option) => option.label), [options]);
  const trimmedInputValue = inputValue.trim();
  const hasExactOption = options.some(
    (option) => option.label.trim().toLocaleLowerCase("th") === trimmedInputValue.toLocaleLowerCase("th")
  );
  const shouldShowCustomValue = allowCustomValue && trimmedInputValue && !hasExactOption;

  React.useEffect(() => {
    if (!open) {
      setInputValue(displayValue);
    }
  }, [displayValue, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (disabled && nextOpen) return;
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    if (!nextOpen) {
      setInputValue(displayValue);
    }
    onOpenChange?.(nextOpen);
  }

  function handleInputValueChange(nextValue: string) {
    setInputValue(nextValue);
    if (allowCustomValue) {
      onValueChange(nextValue);
    }
  }

  function handleSelectLabel(label: string) {
    const selectedOption = options.find((option) => option.label === label);
    onValueChange(selectedOption?.value ?? label);
    setInputValue(label);
  }

  return (
    <Combobox
      disabled={disabled}
      inputValue={inputValue}
      items={optionLabels}
      onInputValueChange={handleInputValueChange}
      onOpenChange={handleOpenChange}
      onValueChange={handleSelectLabel}
      open={open}
      value={activeOption?.label ?? value}
    >
      <BaseComboboxInput
        className={className}
        placeholder={searchPlaceholder || placeholder}
      />
      <ComboboxContent portalled={portalled}>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
        {shouldShowCustomValue ? (
          <div className="border-t border-slate-100 p-1">
            <ComboboxItem value={trimmedInputValue}>
              ใช้ค่า “{trimmedInputValue}”
            </ComboboxItem>
          </div>
        ) : null}
      </ComboboxContent>
    </Combobox>
  );
}
