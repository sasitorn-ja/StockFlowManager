"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type ComboboxContextValue = {
  disabled: boolean;
  filteredItems: readonly string[];
  inputValue: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  selectedValue: string;
  setInputValue: (value: string) => void;
  setOpen: (open: boolean) => void;
};

const ComboboxContext = React.createContext<ComboboxContextValue | null>(null);

function useComboboxContext(componentName: string) {
  const context = React.useContext(ComboboxContext);
  if (!context) {
    throw new Error(`${componentName} must be used within Combobox`);
  }
  return context;
}

type ComboboxProps = {
  children: React.ReactNode;
  disabled?: boolean;
  inputValue?: string;
  items: readonly string[];
  onInputValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  onValueChange?: (value: string) => void;
  open?: boolean;
  value?: string;
};

export function Combobox({
  children,
  disabled = false,
  inputValue: controlledInputValue,
  items,
  onInputValueChange,
  onOpenChange,
  onValueChange,
  open: controlledOpen,
  value = "",
}: ComboboxProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [uncontrolledInputValue, setUncontrolledInputValue] = React.useState(value);
  const open = controlledOpen ?? uncontrolledOpen;
  const inputValue = controlledInputValue ?? uncontrolledInputValue;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (disabled && nextOpen) return;
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, disabled, onOpenChange]
  );

  const setInputValue = React.useCallback(
    (nextValue: string) => {
      if (controlledInputValue === undefined) {
        setUncontrolledInputValue(nextValue);
      }
      onInputValueChange?.(nextValue);
    },
    [controlledInputValue, onInputValueChange]
  );

  React.useEffect(() => {
    if (controlledInputValue === undefined) {
      setUncontrolledInputValue(value);
    }
  }, [controlledInputValue, value]);

  const filteredItems = React.useMemo(() => {
    const query = inputValue.trim().toLocaleLowerCase("th");
    if (!query) return items;
    return items.filter((item) => item.toLocaleLowerCase("th").includes(query));
  }, [inputValue, items]);

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, setOpen]);

  return (
    <ComboboxContext.Provider
      value={{
        disabled,
        filteredItems,
        inputValue,
        onValueChange,
        open,
        selectedValue: value,
        setInputValue,
        setOpen,
      }}
    >
      <div ref={rootRef} className="relative w-full" data-combobox-root>
        {children}
      </div>
    </ComboboxContext.Provider>
  );
}

type ComboboxInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;

export const ComboboxInput = React.forwardRef<HTMLInputElement, ComboboxInputProps>(
  ({ className, disabled, onBlur, onFocus, onKeyDown, placeholder, ...props }, ref) => {
    const context = useComboboxContext("ComboboxInput");

    return (
      <div
        data-combobox-control
        className={cn(
          "flex h-11 w-full items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100",
          (context.disabled || disabled) && "cursor-not-allowed bg-slate-50 opacity-70",
          className
        )}
      >
        <input
          ref={ref}
          data-combobox-input
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={context.open}
          value={context.inputValue}
          disabled={context.disabled || disabled}
          onChange={(event) => {
            context.setInputValue(event.target.value);
            context.setOpen(true);
          }}
          onFocus={(event) => {
            context.setOpen(true);
            onFocus?.(event);
          }}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              context.setOpen(false);
            }
            onKeyDown?.(event);
          }}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          {...props}
        />
        <button
          type="button"
          disabled={context.disabled || disabled}
          aria-label={context.open ? "ปิดรายการ" : "เปิดรายการ"}
          className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => context.setOpen(!context.open)}
        >
          <ChevronDown size={15} />
        </button>
      </div>
    );
  }
);

ComboboxInput.displayName = "ComboboxInput";

type ComboboxContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end";
  portalled?: boolean;
};

export function ComboboxContent({ className, align = "start", portalled: _portalled, ...props }: ComboboxContentProps) {
  const { open } = useComboboxContext("ComboboxContent");
  if (!open) return null;

  return (
    <div
      data-combobox-content
      className={cn(
        "absolute top-[calc(100%+6px)] z-[90] w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-slate-950 shadow-[0_20px_50px_rgba(15,23,42,0.14)]",
        align === "end" && "right-0",
        align === "center" && "left-1/2 -translate-x-1/2",
        align === "start" && "left-0",
        className
      )}
      {...props}
    />
  );
}

type ComboboxEmptyProps = React.HTMLAttributes<HTMLDivElement>;

export function ComboboxEmpty({ className, ...props }: ComboboxEmptyProps) {
  const { filteredItems } = useComboboxContext("ComboboxEmpty");
  if (filteredItems.length > 0) return null;

  return (
    <div
      className={cn("px-3 py-6 text-center text-sm font-semibold text-slate-500", className)}
      {...props}
    />
  );
}

type ComboboxListProps = {
  children: (item: string) => React.ReactNode;
  className?: string;
};

export function ComboboxList({ children, className }: ComboboxListProps) {
  const { filteredItems } = useComboboxContext("ComboboxList");

  return (
    <div className={cn("max-h-[260px] overflow-y-auto p-1", className)}>
      {filteredItems.map((item) => children(item))}
    </div>
  );
}

type ComboboxItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export function ComboboxItem({ children, className, value, onClick, ...props }: ComboboxItemProps) {
  const context = useComboboxContext("ComboboxItem");
  const selected = context.selectedValue === value;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 outline-none transition hover:bg-sky-50 hover:text-sky-700",
        selected && "bg-sky-500 text-white hover:bg-sky-500 hover:text-white",
        className
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        context.setInputValue(value);
        context.onValueChange?.(value);
        context.setOpen(false);
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </button>
  );
}
