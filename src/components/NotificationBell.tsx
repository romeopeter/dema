import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { BellIcon, CategoryGlyph } from "@/components/icons";
import { useInvoices } from "@/features/invoices/hooks";
import { useTransactions } from "@/features/transactions/hooks";
import { formatDate, money, pluralise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useIsBusiness } from "@/store/profileStore";
import { useUiStore } from "@/store/uiStore";

interface Notice {
  key: string;
  title: string;
  body: string;
  tint: string;
  icon: string;
  to: string;
}

/**
 * "Needs attention" is derived, not stored: overdue invoices and unposted drafts are
 * both things the ledger already knows, so the panel cannot drift out of date.
 */
function useNotices(): Notice[] {
  const isBusiness = useIsBusiness();
  const invoices = useInvoices();
  const drafts = useTransactions("drafts");

  const notices: Notice[] = [];

  if (isBusiness) {
    for (const invoice of invoices.data ?? []) {
      if (invoice.displayStatus !== "overdue") continue;
      notices.push({
        key: `invoice-${invoice.id}`,
        title: `Invoice #${invoice.invoiceNumber} is overdue`,
        body: `${invoice.clientName} · ${money(invoice.totalAmountCents)} outstanding since ${formatDate(invoice.dueDate)}.`,
        tint: "#F0C6D9",
        icon: "invoice",
        to: `/invoices?invoice=${invoice.id}`,
      });
    }
  }

  const draftRows = drafts.data ?? [];
  if (draftRows.length > 0) {
    const first = draftRows[0];
    notices.push({
      key: "drafts",
      title: pluralise(draftRows.length, "draft transaction"),
      body: `${first.categoryName} · ${money(first.amountCents)} is saved but not counted in your totals.`,
      tint: "#DADEE5",
      icon: first.categoryIcon,
      to: "/transactions?filter=drafts",
    });
  }

  return notices;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const open = useUiStore((s) => s.notifOpen);
  const setOpen = useUiStore((s) => s.setNotifOpen);
  const notices = useNotices();
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="relative" ref={wrapper}>
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors",
          open ? "border border-faint bg-divider" : "border border-line bg-surface",
        )}
      >
        <BellIcon />
        {notices.length > 0 ? (
          <span className="absolute top-[10px] right-[11px] h-2 w-2 rounded-full bg-alert shadow-[0_0_0_2px_#FFFFFF]" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute top-[54px] right-0 z-20 flex w-[360px] flex-col gap-[2px] rounded-3xl border border-line bg-surface p-[10px] shadow-panel">
          <div className="px-[14px] pt-3 pb-2 text-[12px] font-semibold tracking-[0.06em] text-faint uppercase">
            Needs attention
          </div>

          {notices.length === 0 ? (
            <div className="px-[14px] pt-1 pb-4 text-[13px] leading-[18px] text-muted">
              Nothing needs you right now. Overdue invoices and unposted drafts
              show up here.
            </div>
          ) : (
            notices.map((notice) => (
              <button
                key={notice.key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(notice.to);
                }}
                className="flex items-start gap-3 rounded-[18px] px-[14px] py-3 text-left transition-colors hover:bg-divider"
              >
                <span
                  className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[11px]"
                  style={{ background: notice.tint }}
                >
                  <CategoryGlyph icon={notice.icon} size={18} strokeWidth={1.7} />
                </span>
                <span className="flex flex-col gap-[3px]">
                  <span className="text-[14px] font-semibold">
                    {notice.title}
                  </span>
                  <span className="text-[13px] leading-[18px] text-muted">
                    {notice.body}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
