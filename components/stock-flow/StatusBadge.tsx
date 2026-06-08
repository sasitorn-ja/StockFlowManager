import type { ReactNode } from "react";

type StatusBadgeProps = {
  tone: "in" | "out" | "warn" | "urgent";
  children: ReactNode;
};

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  const toneClassName = {
    in: "bg-[#ecfdf5] text-[#047857] ring-1 ring-[#a7f3d0]",
    out: "bg-[#fffbeb] text-[#b45309] ring-1 ring-[#fde68a]",
    warn: "bg-[#fffbeb] text-[#b45309] ring-1 ring-[#fde68a]",
    urgent: "bg-[#fff1f2] text-[#be123c] ring-1 ring-[#fecdd3]",
  }[tone];

  return (
    <span
      className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${toneClassName}`}
    >
      {children}
    </span>
  );
}
