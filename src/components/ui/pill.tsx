import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const BASE =
  "rounded-full transition-all duration-200 ease-[var(--ease-standard)] outline-none " +
  "focus-visible:ring-[3px] focus-visible:ring-bp-soft disabled:cursor-not-allowed";

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** The period / filter pill: bordered when idle, brand-tinted when selected. */
export function Pill({ selected, className, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        BASE,
        "border-[1.5px] px-6 py-[10px] text-[15px]",
        selected
          ? "border-bp bg-bp-soft font-semibold text-ink"
          : "border-line bg-surface font-medium text-muted hover:bg-divider hover:text-ink",
        "disabled:border-sunken disabled:bg-divider disabled:text-faint disabled:hover:bg-divider",
        className,
      )}
      {...props}
    />
  );
}

/** The borderless pill used inside the Invoices / Clients segmented control. */
export function TabPill({ selected, className, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        BASE,
        "border-none px-[22px] py-[10px] text-[14px]",
        selected
          ? "bg-bp-soft font-semibold text-ink"
          : "bg-transparent font-medium text-muted hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

/** The compact income / expense toggle that sits inside the amount field. */
export function TinyPill({ selected, className, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        BASE,
        "border-[1.5px] px-[18px] py-2 text-[14px]",
        selected
          ? "border-bp bg-bp-soft font-semibold text-ink"
          : "border-line bg-surface font-medium text-muted hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

/** Equal-width choice used for the new-category type picker. */
export function SmallChoice({ selected, className, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        BASE,
        "flex-1 border-[1.5px] bg-surface px-4 py-[10px] text-[14px]",
        selected
          ? "border-bp font-semibold text-ink"
          : "border-line font-medium text-muted hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}
