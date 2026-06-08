import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  children: ReactNode;
};

export function Field({ label, children }: FieldProps) {
  return (
    <label className="grid gap-2">
      <span className="text-[12px] font-semibold text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}
