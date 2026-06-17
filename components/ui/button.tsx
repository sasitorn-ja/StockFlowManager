import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-sky-600 px-4 py-2.5 text-white hover:bg-sky-700",
        secondary:
          "border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2.5 text-[var(--text-body)] hover:bg-sky-50 hover:text-sky-700",
        ghost: "px-3 py-2 text-[var(--text-muted)] hover:bg-sky-50 hover:text-sky-700",
        danger:
          "border border-rose-200 bg-rose-50 px-4 py-2.5 text-rose-700 hover:bg-rose-100",
      },
      size: {
        default: "h-11",
        sm: "h-9 px-3 text-[13px]",
        lg: "h-12 px-5 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
