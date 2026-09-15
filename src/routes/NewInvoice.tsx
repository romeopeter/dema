import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { BackIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { Button, RoundButton } from "@/components/ui/button";
import { Card, Divider, InitialsTile, tintForIndex } from "@/components/ui/controls";
import { DateInput, Label, OutlineInput, TextArea } from "@/components/ui/field";
import { useClients } from "@/features/clients/hooks";
import { useInvoice, useNextInvoiceNumber } from "@/features/invoices/hooks";
import { addDays, amountOnly, money, parseAmountToCents, today } from "@/lib/format";
import { mutate } from "@/lib/mutate";
import { createInvoice, updateInvoice } from "@/lib/tauri";
import type { InvoiceInput, LineItemInput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useProfileStore } from "@/store/profileStore";
import { useSettingsStore } from "@/store/settingsStore";

interface DraftLine {
  description: string;
  quantity: string;
  unitPrice: string;
}

const BLANK_LINE: DraftLine = { description: "", quantity: "1", unitPrice: "" };
const GRID = "grid-cols-[1fr_90px_150px_130px_40px]";

/** Quantity is a real number (half days, hours); the price beside it is minor units. */
function parseQuantity(value: string): number {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function lineCents(line: DraftLine): number {
  const unit = parseAmountToCents(line.unitPrice) ?? 0;
  return Math.round(parseQuantity(line.quantity) * unit);
}

export function NewInvoice() {
  const navigate = useNavigate();
  const params = useParams();
  const profileId = useProfileStore((s) => s.activeProfileId);
  const settings = useSettingsStore((s) => s.values);

  const editingId = params.id ? Number(params.id) : null;
  const existing = useInvoice(editingId);
  const clients = useClients();
  const nextNumber = useNextInvoiceNumber();

  const [clientId, setClientId] = useState<number | null>(null);
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(today(), 14));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ ...BLANK_LINE }]);
  const [saving, setSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const vatRateBp = Number(settings.vat_rate_bp ?? 750);

  // Default to the first client so the summary panel is never blank on arrival.
  useEffect(() => {
    if (clientId === null && (clients.data?.length ?? 0) > 0) {
      setClientId(clients.data![0].id);
    }
  }, [clients.data, clientId]);

  useEffect(() => {
    const invoice = existing.data;
    if (!invoice || prefilled) return;
    setClientId(invoice.clientId);
    setIssueDate(invoice.issueDate.slice(0, 10));
    setDueDate(invoice.dueDate.slice(0, 10));
    setNotes(invoice.notes ?? "");
    setLines(
      invoice.items.map((item) => ({
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: amountOnly(item.unitPriceCents),
      })),
    );
    setPrefilled(true);
  }, [existing.data, prefilled]);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + lineCents(line), 0),
    [lines],
  );
  // Mirrors the Rust rounding exactly, so the previewed total is the stored total.
  const vat = Math.floor((subtotal * vatRateBp + 5000) / 10000);
  const total = subtotal + vat;

  const client = clients.data?.find((c) => c.id === clientId) ?? null;
  const usableLines = lines.filter(
    (line) => line.description.trim() !== "" && lineCents(line) > 0,
  );
  const ready = subtotal > 0 && clientId !== null && usableLines.length > 0;

  const termDays = Math.max(
    0,
    Math.round(
      (new Date(dueDate).getTime() - new Date(issueDate).getTime()) / 86_400_000,
    ),
  );

  function update(index: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  async function save(status: "draft" | "sent") {
    if (!ready || !profileId) return;
    setSaving(true);

    const items: LineItemInput[] = usableLines.map((line) => ({
      description: line.description.trim(),
      quantity: parseQuantity(line.quantity),
      unitPriceCents: parseAmountToCents(line.unitPrice) ?? 0,
    }));

    const input: InvoiceInput = {
      profileId,
      clientId: clientId!,
      issueDate,
      dueDate,
      status,
      notes: notes.trim() === "" ? null : notes.trim(),
      vatRateBp,
      items,
    };

    const saved = editingId
      ? await mutate(() => updateInvoice(editingId, input), {
          success: "Invoice updated.",
        })
      : await mutate(() => createInvoice(input), {
          success:
            status === "sent"
              ? "Invoice sent."
              : "Invoice saved as a draft.",
        });

    setSaving(false);
    if (saved) navigate(`/invoices?invoice=${saved.id}`);
  }

  return (
    <div className="flex h-full flex-col gap-[22px] px-10 py-8">
      <div className="flex items-center gap-4">
        <RoundButton aria-label="Back" onClick={() => navigate("/invoices")}>
          <BackIcon />
        </RoundButton>
        <div className="flex flex-col gap-[2px]">
          <h1 className="m-0 font-display text-[28px] leading-[34px] font-bold">
            {editingId ? "Edit invoice" : "New invoice"}
          </h1>
          <div className="text-[14px] text-muted">
            {editingId
              ? `#${existing.data?.invoiceNumber ?? ""}`
              : `Next number · #${nextNumber.data ?? "—"}`}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_380px] gap-5 pb-8 max-xl:grid-cols-1">
        <Card className="flex min-h-0 flex-col p-0 shadow-card">
          <div className="scroll-area flex flex-col gap-[26px] px-8 py-7">
            <div className="flex flex-col gap-3">
              <Label>Client</Label>
              {clients.data?.length === 0 ? (
                <div className="rounded-[18px] bg-divider px-5 py-4 text-[14px] text-muted">
                  Add a client first — every invoice is billed to one.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-[10px] pt-3">
                  {(clients.data ?? []).map((option, index) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setClientId(option.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-[18px] border-[1.5px] bg-surface px-[14px] py-3 text-left transition-all duration-200 ease-[var(--ease-standard)]",
                        option.id === clientId ? "border-bp" : "border-line",
                      )}
                    >
                      <InitialsTile
                        name={option.name}
                        tint={tintForIndex(index)}
                        size={34}
                        radius={11}
                      />
                      <span className="min-w-0 truncate text-[14px] font-medium">
                        {option.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <div className="flex flex-1 flex-col gap-[10px]">
                <Label>Issue date</Label>
                <DateInput
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-[10px]">
                <Label>Due date</Label>
                <DateInput
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-[10px]">
                <Label>Terms</Label>
                <div className="rounded-2xl bg-divider px-[18px] py-[14px] text-[15px] text-muted">
                  Net {termDays}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setLines((c) => [...c, { ...BLANK_LINE }])}
                >
                  <PlusIcon size={14} />
                  Add line
                </Button>
              </div>

              <div
                className={`grid ${GRID} gap-3 px-1 text-[12px] font-semibold tracking-[0.06em] text-faint uppercase`}
              >
                <div>Description</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Unit price</div>
                <div className="text-right">Amount</div>
                <div />
              </div>

              {lines.map((line, index) => (
                <div key={index} className={`grid ${GRID} items-center gap-3`}>
                  <OutlineInput
                    value={line.description}
                    onChange={(e) => update(index, { description: e.target.value })}
                    placeholder="What are you billing for?"
                  />
                  <OutlineInput
                    value={line.quantity}
                    inputMode="decimal"
                    className="text-right"
                    onChange={(e) => update(index, { quantity: e.target.value })}
                  />
                  <OutlineInput
                    value={line.unitPrice}
                    inputMode="decimal"
                    className="text-right"
                    placeholder="0"
                    onChange={(e) => update(index, { unitPrice: e.target.value })}
                  />
                  <div className="tnum text-right text-[17px] font-bold">
                    {money(lineCents(line))}
                  </div>
                  <button
                    type="button"
                    aria-label="Remove line"
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((c) => c.filter((_, i) => i !== index))
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-divider text-muted transition-colors hover:bg-[#F0C6D9] hover:text-ink disabled:opacity-40 disabled:hover:bg-divider"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-[10px]">
              <Label optional>Note on invoice</Label>
              <TextArea
                value={notes}
                rows={2}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment by bank transfer within 14 days."
              />
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-line px-8 py-5">
            <div className="text-[13px] text-muted">
              {ready
                ? `Ready to send to ${client?.name ?? "this client"}.`
                : "Add at least one line item with a price."}
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                disabled={!ready || saving}
                onClick={() => save("draft")}
              >
                Save as draft
              </Button>
              <Button
                size="lg"
                disabled={!ready || saving}
                onClick={() => save("sent")}
              >
                {editingId ? "Save invoice" : "Send invoice"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-5">
          <div className="font-display text-[18px] font-semibold">Summary</div>

          <div className="flex flex-col gap-[10px] rounded-[20px] bg-divider p-[18px]">
            <div className="text-[13px] text-muted">Billed to</div>
            <div className="text-[16px] font-semibold">
              {client?.name ?? "No client selected"}
            </div>
            <div className="text-[13px] leading-[19px] text-muted">
              {client?.address ?? "—"}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-[15px]">
              <span className="text-muted">Lines</span>
              <span>{usableLines.length}</span>
            </div>
            <div className="flex justify-between text-[15px]">
              <span className="text-muted">Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[15px]">
              <span className="text-muted">
                VAT {(vatRateBp / 100).toFixed(1)}%
              </span>
              <span>{money(vat)}</span>
            </div>
            <Divider />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Total</span>
              <span className="tnum text-[26px] font-bold">{money(total)}</span>
            </div>
          </div>

          <div className="mt-auto rounded-[20px] bg-bp-soft px-[18px] py-4 text-[13px] leading-[19px] text-ink">
            When this invoice is marked paid, Dema posts a linked income
            transaction for {money(total)}.
          </div>
        </Card>
      </div>
    </div>
  );
}
