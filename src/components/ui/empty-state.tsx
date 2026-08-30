import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  actions,
  className,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center pb-8">
      <div
        className={cn(
          "flex max-w-[620px] flex-col items-center gap-5 rounded-3xl bg-surface " +
            "px-16 py-14 text-center shadow-card",
          className,
        )}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-[32px] bg-divider text-faint">
          {icon}
        </div>
        <h2 className="m-0 font-display text-[26px] font-bold">{title}</h2>
        <p className="m-0 max-w-[420px] text-[16px] leading-6 text-pretty text-muted">
          {body}
        </p>
        {actions ? <div className="flex gap-3 pt-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/** The skeleton row from the component-states sheet, reused wherever a list loads. */
export function RowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-1 py-[14px]">
          <div className="h-11 w-11 flex-none rounded-[15px] bg-sunken" />
          <div className="flex flex-1 flex-col gap-[6px]">
            <div className="h-3 w-[120px] rounded-full bg-sunken" />
            <div className="h-[10px] w-20 rounded-full bg-divider" />
          </div>
          <div className="h-[14px] w-[84px] rounded-full bg-sunken" />
        </div>
      ))}
    </div>
  );
}

export function ErrorNote({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border-[1.5px] border-alert bg-alert-bg px-5 py-4">
      <div className="flex-1 text-[14px] text-ink">{message}</div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border-[1.5px] border-alert bg-surface px-4 py-2 text-[13px] font-semibold text-ink"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
