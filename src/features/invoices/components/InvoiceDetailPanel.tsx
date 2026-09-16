import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { AlertIcon, CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, Divider, STATUS_LABEL } from "@/components/ui/controls";
import { RowSkeleton } from "@/components/ui/empty-state";
import { formatDate, money } from "@/lib/format";
import { mutate } from "@/lib/mutate";
import { markInvoicePaid, reopenInvoice, sendInvoice } from "@/lib/tauri";
import type { InvoiceDetail } from "@/lib/types";

const BADGE_TINT: Record<string, string> = {
  paid: "var(--brand-soft)",
  sent: "#B8DCF0",
  overdue: "#F0C6D9",
  draft: "#DADEE5",
};

const COLUMNS = "grid-cols-[1fr_80px_140px_140px]";

export function InvoiceDetailPanel({
  invoice,
  loading,
}: {
  invoice: InvoiceDetail | null;
  loading: boolean;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!invoice) {
    return (
      <Card className="flex min-h-0 flex-col p-8 shadow-card">
        {loading ? (
          <RowSkeleton rows={4} />
        ) : (
          <div className="m-auto text-[15px] text-muted">
            Pick an invoice to see it here.
          </div>
        )}
      </Card>
    );
  }

  const status = invoice.displayStatus;
  const paid = invoice.status === "paid";

  async function act(
    action: () => Promise<unknown>,
    success: string,
  ): Promise<void> {
    setBusy(true);
    await mutate(action, { success });
    setBusy(false);
  }

  return (
    <Card className="flex min-h-0 flex-col p-0 shadow-card">
      <div className="scroll-area flex flex-col gap-6 px-8 py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-[6px]">
            <div className="font-display text-[26px] font-bold">
              #{invoice.invoiceNumber}
            </div>
            <div className="text-[15px] text-muted">
              {invoice.clientName} · Issued {formatDate(invoice.issueDate)} · due{" "}
              {formatDate(invoice.dueDate)}
            </div>
          </div>
          <span
            className="rounded-full px-4 py-[7px] text-[12px] font-semibold tracking-[0.04em] uppercase"
            style={{ background: BADGE_TINT[status] }}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>

        {status === "overdue" ? (
          <div className="flex items-center gap-[14px] rounded-[20px] border-[1.5px] border-bs bg-alert-bg px-5 py-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-surface text-alert">
              <AlertIcon size={20} />
            </span>
            <div className="flex flex-1 flex-col gap-[2px]">
              <div className="text-[15px] font-semibold">
                Overdue since {formatDate(invoice.dueDate)} ·{" "}
                {money(invoice.totalAmountCents)} outstanding
              </div>
              <div className="text-[13px] text-ink/70">
                Send a reminder, or mark it paid if the money has landed.
              </div>
            </div>
          </div>
        ) : null}

        {paid && invoice.transactionId ? (
          <div className="flex items-center gap-[14px] rounded-[20px] bg-bp-soft px-5 py-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-surface text-success">
              <CheckIcon size={20} />
            </span>
            <div className="flex flex-1 flex-col gap-[2px]">
              <div className="text-[15px] font-semibold">
                Income transaction created
              </div>
              <div className="text-[13px] text-ink/70">
                {money(invoice.totalAmountCents)} posted to income, linked to #
                {invoice.invoiceNumber}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/transactions/${invoice.transactionId}`)}
              className="text-[14px] font-semibold text-link hover:text-ink"
            >
              View
            </button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[20px] border border-line">
          <div
            className={`grid ${COLUMNS} gap-3 bg-divider px-5 py-[14px] text-[12px] font-semibold tracking-[0.06em] text-muted uppercase`}
          >
            <div>Description</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Unit price</div>
            <div className="text-right">Amount</div>
          </div>
          {invoice.items.map((item) => (
            <div
              key={item.id}
              className={`grid ${COLUMNS} gap-3 border-t border-divider px-5 py-4 text-[15px]`}
            >
              <div>{item.description}</div>
              <div className="text-right text-muted">{item.quantity}</div>
              <div className="text-right text-muted">
                {money(item.unitPriceCents)}
              </div>
              <div className="text-right font-semibold">
                {money(item.amountCents)}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <div className="flex w-80 flex-col gap-[10px]">
            <div className="flex justify-between text-[15px]">
              <span className="text-muted">Subtotal</span>
              <span>{money(invoice.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-[15px]">
              <span className="text-muted">
                VAT {(invoice.vatRateBp / 100).toFixed(1)}%
              </span>
              <span>{money(invoice.vatCents)}</span>
            </div>
            <Divider />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Total due</span>
              <span className="tnum text-[24px] font-bold">
                {money(invoice.totalAmountCents)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-line px-8 py-5">
        <div className="text-[13px] text-muted">
          {paid
            ? "Reopening removes the linked income transaction."
            : "Marking paid posts a linked income transaction."}
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate(`/invoices/${invoice.id}/document`)}
          >
            Open document
          </Button>

          {paid ? (
            <Button
              variant="secondary"
              size="lg"
              disabled={busy}
              onClick={() =>
                act(
                  () => reopenInvoice(invoice.id),
                  `#${invoice.invoiceNumber} reopened and its income removed.`,
                )
              }
            >
              Reopen
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              disabled={busy}
              onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
            >
              Edit
            </Button>
          )}

          {invoice.status === "draft" ? (
            <Button
              size="lg"
              disabled={busy}
              onClick={() =>
                act(
                  () => sendInvoice(invoice.id),
                  `#${invoice.invoiceNumber} marked as sent.`,
                )
              }
            >
              Mark as sent
            </Button>
          ) : (
            <Button
              size="lg"
              disabled={busy || paid}
              onClick={() =>
                act(
                  () => markInvoicePaid(invoice.id),
                  `#${invoice.invoiceNumber} paid — ${money(invoice.totalAmountCents)} posted to income.`,
                )
              }
            >
              {paid ? "Paid" : "Mark as paid"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
