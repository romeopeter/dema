import { useNavigate, useParams } from "react-router-dom";

import { BackIcon, CheckIcon, DownloadIcon, WarnIcon } from "@/components/icons";
import { Button, RoundButton } from "@/components/ui/button";
import { ErrorNote } from "@/components/ui/empty-state";
import { InvoiceSheet } from "@/features/invoices/components/InvoiceSheet";
import { mutate } from "@/lib/mutate";
import { invoiceDocument, setInvoiceRows } from "@/lib/tauri";
import { useQuery } from "@/lib/useQuery";
import type { DocumentRows, InvoiceDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

const TOGGLES: { key: keyof DocumentRows; label: string }[] = [
  { key: "subtotal", label: "Subtotal" },
  { key: "discount", label: "Discount" },
  { key: "vat", label: "VAT" },
  { key: "paid", label: "Amount paid" },
  { key: "balance", label: "Balance due" },
  { key: "grand", label: "Grand total" },
  { key: "notes", label: "Notes" },
  { key: "signature", label: "Signature" },
];

/**
 * The invoice as it will print. Lives outside the app shell so the printed page is the
 * sheet and nothing else — the control strip carries `no-print` and drops away.
 */
export function InvoiceDocumentRoute() {
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id ? Number(params.id) : null;

  const query = useQuery<InvoiceDocument>(() => invoiceDocument(id!), [id], {
    enabled: id !== null,
  });
  const doc = query.data;

  async function toggle(key: keyof DocumentRows) {
    if (!doc) return;
    await mutate(() =>
      setInvoiceRows(doc.invoice.id, {
        ...doc.invoice.show,
        [key]: !doc.invoice.show[key],
      }),
    );
  }

  return (
    <div className="min-h-full bg-page">
      <div className="no-print mx-auto flex max-w-[794px] flex-col gap-3 px-4 pt-7 pb-1">
        <div className="flex flex-wrap items-center gap-4">
          <RoundButton
            aria-label="Back"
            onClick={() => navigate(`/invoices?invoice=${id}`)}
          >
            <BackIcon />
          </RoundButton>
          <div className="flex flex-col gap-[2px]">
            <div className="font-display text-[20px] font-bold">
              Business invoice
            </div>
            <div className="text-[13px] text-muted">
              This is exactly what prints. Edit the figures on the invoice, and your
              business details in Settings.
            </div>
          </div>
          <div className="ml-auto flex items-center gap-[10px]">
            <Button
              variant="secondary"
              size="xs"
              className="text-[14px]"
              onClick={() => navigate(`/invoices/${id}/edit`)}
            >
              Edit invoice
            </Button>
            <Button
              size="xs"
              className="text-[14px]"
              disabled={!doc}
              onClick={() => window.print()}
            >
              <DownloadIcon size={17} />
              Export PDF
            </Button>
          </div>
        </div>

        {doc ? (
          <div className="flex flex-wrap items-center gap-[10px] rounded-[18px] border-[1.5px] border-line bg-surface px-[18px] py-[14px]">
            <span className="mr-1 text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">
              Show rows
            </span>
            {TOGGLES.map(({ key, label }) => {
              const on = doc.invoice.show[key];
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(key)}
                  className={cn(
                    "flex items-center gap-[7px] rounded-full border-[1.5px] py-[7px] pr-[14px] pl-[9px] font-display text-[13px] font-semibold transition-all duration-[160ms] ease-[var(--ease-standard)]",
                    on
                      ? "border-bp bg-bp-soft text-ink"
                      : "border-line bg-surface text-muted hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-[17px] w-[17px] flex-none items-center justify-center rounded-md",
                      on
                        ? "bg-bp text-white"
                        : "bg-surface shadow-[inset_0_0_0_1.5px_#DADEE5]",
                    )}
                  >
                    {on ? <CheckIcon size={11} /> : null}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        {doc && doc.missing.length > 0 ? (
          <div className="flex items-start gap-3 rounded-[18px] border-[1.5px] border-warn-line bg-warn-bg px-[18px] py-4">
            <span className="mt-px flex-none text-[#B4761B]">
              <WarnIcon size={20} />
            </span>
            <div className="flex flex-col gap-[2px]">
              <div className="text-[14px] font-semibold text-warn-title">
                This invoice is missing {doc.missing.join(", ")}
              </div>
              <div className="text-[13px] leading-5 text-warn-body">
                It will still print, but a client cannot pay from it.{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => navigate("/settings")}
                >
                  Add them in Settings
                </button>
                .
              </div>
            </div>
          </div>
        ) : null}

        {query.error ? (
          <ErrorNote message={query.error} onRetry={query.reload} />
        ) : null}
      </div>

      <div className="flex justify-center px-4 py-6 print:p-0">
        {doc ? (
          <InvoiceSheet doc={doc} />
        ) : (
          <div className="h-[1123px] w-[794px] animate-pulse rounded bg-surface" />
        )}
      </div>
    </div>
  );
}
