import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { BackIcon, CategoryGlyph, InvoiceIcon } from "@/components/icons";
import { Button, RoundButton } from "@/components/ui/button";
import { Card, Divider, IconTile, RadioDot } from "@/components/ui/controls";
import { ErrorNote } from "@/components/ui/empty-state";
import { DateInput, FieldError, Label, TextInput } from "@/components/ui/field";
import { TinyPill } from "@/components/ui/pill";
import { useCategories, useTransactions } from "@/features/transactions/hooks";
import {
  PAYMENT_LABELS,
  amountError,
  amountOnly,
  formatDate,
  money,
  parseAmountToCents,
  today,
} from "@/lib/format";
import { mutate } from "@/lib/mutate";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/tauri";
import { resolveTint } from "@/lib/theme";
import type {
  Kind,
  NewTransaction,
  PaymentType,
  TransactionRow,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useActiveProfile } from "@/store/profileStore";

const PAYMENTS: PaymentType[] = ["cash", "card", "check"];

export function TransactionForm() {
  const navigate = useNavigate();
  const params = useParams();
  const profile = useActiveProfile();
  const categories = useCategories();

  const editingId = params.id ? Number(params.id) : null;
  // The list is already in memory whenever this screen is reached from a row, and
  // re-reading it costs a millisecond, so there is no separate get-one command.
  const all = useTransactions("all");
  const editing: TransactionRow | null =
    editingId === null
      ? null
      : ((all.data ?? []).find((t) => t.id === editingId) ?? null);

  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);
  const [kind, setKind] = useState<Kind>("expense");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [payment, setPayment] = useState<PaymentType>("cash");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Prefill once the row arrives; later edits to the fields must not be clobbered.
  useEffect(() => {
    if (!editing || prefilled) return;
    setAmount(amountOnly(editing.amountCents));
    setKind(editing.kind);
    setCategoryId(editing.categoryId);
    setPayment(editing.paymentType);
    setDate(editing.date.slice(0, 10));
    setNote(editing.note ?? "");
    setTouched(true);
    setPrefilled(true);
  }, [editing, prefilled]);

  const choices = useMemo(
    () => categories.selectable.filter((c) => c.kind === kind),
    [categories.selectable, kind],
  );

  // Keep the selection valid: switching income/expense changes which tiles exist.
  useEffect(() => {
    if (choices.length === 0) return;
    if (!choices.some((c) => c.id === categoryId)) {
      setCategoryId(choices[0].id);
    }
  }, [choices, categoryId]);

  const linked = editing?.invoiceNumber ?? null;
  const readOnly = linked !== null;

  const cents = parseAmountToCents(amount);
  const error = touched ? amountError(amount) : "";
  const valid = cents !== null && cents > 0 && categoryId !== null && !readOnly;
  const selected = choices.find((c) => c.id === categoryId) ?? null;

  function buildInput(status: "draft" | "posted"): NewTransaction {
    return {
      profileId: profile!.id,
      amountCents: cents!,
      categoryId: categoryId!,
      paymentType: payment,
      status,
      kind,
      date,
      note: note.trim() === "" ? null : note.trim(),
    };
  }

  async function save(status: "draft" | "posted") {
    if (!valid || !profile) return;
    setSaving(true);
    const input = buildInput(status);
    const result = editing
      ? await mutate(() => updateTransaction(editing.id, input), {
          success: status === "draft" ? "Saved as draft." : "Transaction saved.",
        })
      : await mutate(() => createTransaction(input), {
          success:
            status === "draft"
              ? "Saved as draft — it stays out of your totals."
              : "Transaction added.",
        });
    setSaving(false);
    if (result) navigate(-1);
  }

  async function remove() {
    if (!editing) return;
    setSaving(true);
    const done = await mutate(() => deleteTransaction(editing.id), {
      success: "Transaction deleted.",
    });
    setSaving(false);
    if (done !== null) navigate("/");
  }

  return (
    <div className="flex h-full flex-col gap-6 px-10 py-8">
      <div className="flex items-center gap-4">
        <RoundButton aria-label="Back" onClick={() => navigate(-1)}>
          <BackIcon />
        </RoundButton>
        <div className="flex flex-col gap-[2px]">
          <h1 className="m-0 font-display text-[28px] leading-[34px] font-bold">
            {editing ? "Edit transaction" : "Add transaction"}
          </h1>
          <div className="text-[14px] text-muted">
            Posting to the {profile?.type === "business" ? "Business" : "Personal"}{" "}
            profile
          </div>
        </div>

        {editing ? (
          <div className="ml-auto flex items-center gap-3">
            {linked ? (
              <button
                type="button"
                onClick={() => navigate("/invoices")}
                className="flex items-center gap-2 rounded-full bg-[#B8DCF0] px-[18px] py-[10px] text-[14px] font-semibold text-ink"
              >
                <InvoiceIcon size={16} />
                from Invoice #{linked}
              </button>
            ) : null}
            <Button variant="danger" size="sm" onClick={remove} disabled={saving}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {readOnly ? (
        <ErrorNote
          message={`This income was posted by invoice #${linked}. Edit the invoice, or reopen it, to change these figures.`}
        />
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_380px] gap-5 max-xl:grid-cols-1">
        <Card className="flex min-h-0 flex-col p-0 shadow-card">
          <div className="scroll-area flex flex-col gap-7 px-8 py-7">
            <div className="flex flex-col gap-[10px]">
              <Label>Amount</Label>
              <div
                className={cn(
                  "flex items-center gap-[10px] rounded-[20px] border-[1.5px] px-6 py-[18px] transition-colors",
                  error
                    ? "border-alert bg-alert-bg"
                    : "border-divider bg-divider focus-within:border-bp focus-within:bg-surface",
                )}
              >
                <span className="tnum text-[28px] font-bold text-muted">₦</span>
                <input
                  value={amount}
                  disabled={readOnly}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setTouched(true);
                  }}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="tnum min-w-0 flex-1 border-none bg-transparent text-[28px] font-bold text-ink outline-none placeholder:text-faint"
                />
                <div className="flex gap-2">
                  <TinyPill
                    selected={kind === "expense"}
                    disabled={readOnly}
                    onClick={() => setKind("expense")}
                  >
                    Expense
                  </TinyPill>
                  <TinyPill
                    selected={kind === "income"}
                    disabled={readOnly}
                    onClick={() => setKind("income")}
                  >
                    Income
                  </TinyPill>
                </div>
              </div>
              <FieldError>{error}</FieldError>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Category</Label>
                <button
                  type="button"
                  onClick={() => navigate("/settings")}
                  className="text-[13px] font-medium text-link hover:text-ink"
                >
                  Manage categories
                </button>
              </div>

              {choices.length === 0 ? (
                <div className="rounded-[18px] bg-divider px-5 py-4 text-[14px] text-muted">
                  No {kind} categories yet. Add one in Settings.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-[10px]">
                  {choices.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() => setCategoryId(category.id)}
                      className={cn(
                        "flex flex-col items-center gap-[10px] rounded-[20px] border-[1.5px] bg-surface px-2 py-[14px] transition-all duration-200 ease-[var(--ease-standard)]",
                        categoryId === category.id
                          ? "border-bp shadow-row"
                          : "border-line hover:border-faint",
                      )}
                    >
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-[13px]"
                        style={{ background: resolveTint(category.color) }}
                      >
                        <CategoryGlyph icon={category.icon} size={20} />
                      </span>
                      <span className="text-center text-[13px] font-medium">
                        {category.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Label>Payment type</Label>
              <div className="flex gap-3">
                {PAYMENTS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setPayment(option)}
                    className={cn(
                      "flex flex-1 items-center gap-3 rounded-full border-[1.5px] bg-surface px-5 py-[15px] text-[15px] transition-colors",
                      payment === option
                        ? "border-bp font-semibold text-ink"
                        : "border-line font-medium text-muted hover:text-ink",
                    )}
                  >
                    <RadioDot on={payment === option} size={20} />
                    {PAYMENT_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-1 flex-col gap-[10px]">
                <Label>Date</Label>
                <DateInput
                  value={date}
                  disabled={readOnly}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-[10px]">
                <Label optional>Note</Label>
                <TextInput
                  value={note}
                  disabled={readOnly}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What was this for?"
                />
              </div>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-line px-8 py-5">
            <div className="text-[13px] text-muted">
              Drafts are saved but stay out of your totals.
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                disabled={!valid || saving}
                onClick={() => save("draft")}
              >
                Save as draft
              </Button>
              <Button
                size="lg"
                disabled={!valid || saving}
                onClick={() => save("posted")}
              >
                {editing ? "Save changes" : "Add transaction"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-5">
          <div className="font-display text-[18px] font-semibold">Preview</div>
          <div className="flex items-center gap-[14px] rounded-[20px] bg-divider p-[18px]">
            <IconTile
              icon={selected?.icon ?? "office"}
              tint={selected?.color ?? "#DADEE5"}
              dim={!valid}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <div className="truncate text-[16px] font-semibold">
                {selected?.name ?? "Pick a category"}
              </div>
              <div className="text-[13px] text-muted">
                {PAYMENT_LABELS[payment]} · {formatDate(date)}
              </div>
            </div>
            <div
              className={cn(
                "tnum text-[18px] font-bold",
                !valid
                  ? "text-faint"
                  : kind === "income"
                    ? "text-success"
                    : "text-ink",
              )}
            >
              {cents && cents > 0
                ? money(kind === "income" ? cents : -cents, { sign: true })
                : "₦0"}
            </div>
          </div>

          <Divider />

          <div className="flex flex-col gap-3 text-[14px]">
            <div className="flex justify-between">
              <span className="text-muted">Profile</span>
              <span className="font-medium">
                {profile?.type === "business" ? "Business" : "Personal"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Payment</span>
              <span className="font-medium">{PAYMENT_LABELS[payment]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Counts toward totals</span>
              <span className="font-medium">
                {editing?.status === "draft" || !editing ? "On add" : "Yes"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
