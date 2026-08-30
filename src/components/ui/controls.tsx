import type { HTMLAttributes, ReactNode } from "react";

import { CategoryGlyph } from "@/components/icons";
import { resolveTint } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { InvoiceDisplayStatus } from "@/lib/types";

/** The radio dot: a thick brand ring when on, a hairline circle when off. */
export function RadioDot({
  on,
  size = 22,
  className,
}: {
  on: boolean;
  size?: 22 | 20 | 16;
  className?: string;
}) {
  const ring = size === 22 ? 6.5 : size === 20 ? 6 : 5;
  return (
    <span
      aria-hidden
      className={cn("flex-none rounded-full bg-surface", className)}
      style={{
        width: size,
        height: size,
        border: on
          ? `${ring}px solid var(--brand-primary)`
          : "1.5px solid var(--color-line, #E4E6EB)",
      }}
    />
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-[30px] w-[52px] cursor-pointer items-center rounded-full p-[3px]",
        "transition-colors duration-200 ease-[var(--ease-standard)] outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-bp-soft",
        checked ? "justify-end bg-bp" : "justify-start bg-hairline",
      )}
    >
      <span className="h-6 w-6 rounded-full bg-surface shadow-row" />
    </button>
  );
}

const STATUS_TINT: Record<InvoiceDisplayStatus | "draft-tx" | "invoice", string> = {
  paid: "var(--brand-soft)",
  sent: "#B8DCF0",
  overdue: "#F0C6D9",
  draft: "#DADEE5",
  "draft-tx": "#DADEE5",
  invoice: "#B8DCF0",
};

export const STATUS_LABEL: Record<InvoiceDisplayStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

export function StatusBadge({
  status,
  className,
  muted = false,
}: {
  status: keyof typeof STATUS_TINT;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-[10px] py-[3px] text-[11px] font-semibold tracking-[0.04em] uppercase",
        muted ? "text-muted" : "text-ink",
        className,
      )}
      style={{ background: STATUS_TINT[status] }}
    >
      {status === "draft-tx"
        ? "Draft"
        : status === "invoice"
          ? "Invoice"
          : STATUS_LABEL[status as InvoiceDisplayStatus]}
    </span>
  );
}

/** The rounded tinted square that holds a category glyph. */
export function IconTile({
  icon,
  tint,
  size = 48,
  radius = 16,
  glyph = 22,
  dim = false,
  className,
}: {
  icon: string;
  tint: string;
  size?: number;
  radius?: number;
  glyph?: number;
  dim?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("flex flex-none items-center justify-center", className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: dim ? "#ECEDF0" : resolveTint(tint),
      }}
    >
      <CategoryGlyph icon={icon} size={glyph} color={dim ? "#8B93A6" : "#1A2B49"} />
    </span>
  );
}

/** Initials tile used for clients. */
export function InitialsTile({
  name,
  tint,
  size = 38,
  radius = 12,
  className,
}: {
  name: string;
  tint: string;
  size?: number;
  radius?: number;
  className?: string;
}) {
  const initials = name.split(" ")[0]?.slice(0, 2).toUpperCase() ?? "?";
  return (
    <span
      className={cn(
        "flex flex-none items-center justify-center font-display text-[15px] font-bold text-ink",
        className,
      )}
      style={{ width: size, height: size, borderRadius: radius, background: tint }}
    >
      {initials}
    </span>
  );
}

/** Client avatars cycle this set so a list reads as distinct rows at a glance. */
export const AVATAR_TINTS = [
  "var(--brand-soft)",
  "#F6D9A9",
  "#B8DCF0",
  "#DDD4F0",
  "#F0C6D9",
];

export function tintForIndex(index: number) {
  return AVATAR_TINTS[index % AVATAR_TINTS.length];
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-line", className)} />;
}

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[12px] font-semibold tracking-[0.06em] text-faint uppercase",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-3xl bg-surface p-7 shadow-row", className)}
      {...props}
    />
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("font-display text-[20px] font-semibold", className)}>
      {children}
    </div>
  );
}
