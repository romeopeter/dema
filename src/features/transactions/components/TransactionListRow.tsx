import { IconTile, StatusBadge } from "@/components/ui/controls";
import { PAYMENT_LABELS, formatDate, money } from "@/lib/format";
import type { TransactionRow } from "@/lib/types";

/** The meta line under a transaction title: payment method, then whatever qualifies it. */
export function transactionMeta(tx: TransactionRow): string {
  const parts = [PAYMENT_LABELS[tx.paymentType] ?? tx.paymentType];
  if (tx.invoiceNumber) parts.push(`from Invoice #${tx.invoiceNumber}`);
  else if (tx.note) parts.push(tx.note);
  else if (tx.kind === "income") parts.push("Income");
  return parts.join(" · ");
}

export function TransactionListRow({
  tx,
  onOpen,
}: {
  tx: TransactionRow;
  onOpen: (tx: TransactionRow) => void;
}) {
  const draft = tx.status === "draft";
  // A draft is greyed rather than coloured: it is not money yet.
  const amountColor = draft
    ? "text-faint"
    : tx.kind === "income"
      ? "text-success"
      : "text-ink";

  return (
    <button
      type="button"
      onClick={() => onOpen(tx)}
      className="flex w-full items-center gap-4 rounded-[14px] border-b border-divider px-1 py-[14px] text-left transition-colors duration-200 ease-[var(--ease-standard)] hover:bg-subtle"
    >
      <IconTile icon={tx.categoryIcon} tint={tx.categoryColor} dim={draft} />

      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex items-center gap-2">
          <span
            className={`text-[16px] font-semibold ${draft ? "text-muted" : "text-ink"}`}
          >
            {tx.categoryName}
          </span>
          {draft ? <StatusBadge status="draft-tx" muted /> : null}
          {!draft && tx.invoiceNumber ? <StatusBadge status="invoice" /> : null}
        </div>
        <span className="truncate text-[13px] text-muted">
          {transactionMeta(tx)}
        </span>
      </div>

      <div className="flex flex-col items-end gap-[3px]">
        <span className={`tnum text-[18px] font-bold ${amountColor}`}>
          {money(tx.kind === "income" ? tx.amountCents : -tx.amountCents, {
            sign: true,
          })}
        </span>
        <span className="text-[13px] text-faint">{formatDate(tx.date)}</span>
      </div>
    </button>
  );
}
