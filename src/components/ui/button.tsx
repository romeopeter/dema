import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * The button states in the handoff's component-states sheet, one variant each.
 * Disabled always pairs a desaturated brand fill with `cursor: not-allowed` — the sheet
 * treats that pairing as the signal, so it never appears without the other half.
 */
const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold " +
    "transition-all duration-200 ease-[var(--ease-standard)] outline-none " +
    "focus-visible:ring-[3px] focus-visible:ring-bp focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-surface disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-bp text-on-bp shadow-brand hover:bg-bp-hover active:bg-bp-pressed " +
          "disabled:bg-bp-edge disabled:text-white disabled:shadow-none",
        secondary:
          "border-[1.5px] border-line bg-surface text-ink hover:bg-divider " +
          "hover:border-faint disabled:text-faint disabled:hover:bg-surface " +
          "disabled:hover:border-line",
        outline:
          "border-[1.5px] border-bp bg-surface text-ink hover:bg-bp-soft " +
          "disabled:border-line disabled:text-faint",
        danger:
          "border-[1.5px] border-line bg-surface text-alert hover:bg-alert-bg " +
          "hover:border-alert",
        quiet:
          "border border-line bg-surface text-ink font-body font-medium " +
          "hover:bg-divider disabled:text-faint",
      },
      size: {
        lg: "px-8 py-[13px] text-[16px]",
        md: "px-[26px] py-[13px] text-[16px]",
        sm: "px-[22px] py-3 text-[14px]",
        xs: "px-[18px] py-2 text-[13px]",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(button({ variant, size }), className)}
      {...props}
    />
  );
}

/** The round 44px back / bell button that sits at the top-left of most screens. */
export function RoundButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-11 w-11 flex-none items-center justify-center rounded-full border " +
          "border-line bg-surface text-ink transition-colors duration-200 " +
          "ease-[var(--ease-standard)] hover:bg-divider outline-none " +
          "focus-visible:ring-[3px] focus-visible:ring-bp-soft",
        className,
      )}
      {...props}
    />
  );
}
