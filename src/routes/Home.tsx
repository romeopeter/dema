import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { NotificationBell } from "@/components/NotificationBell";
import { EmptyLedgerIcon, ForwardIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/controls";
import { EmptyState, ErrorNote, RowSkeleton } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { TransactionListRow } from "@/features/transactions/components/TransactionListRow";
import { useInvoiceSummary } from "@/features/invoices/hooks";
import { useDashboard, useTransactions } from "@/features/transactions/hooks";
import { money } from "@/lib/format";
import { resolveTint } from "@/lib/theme";
import type { Period } from "@/lib/types";
import { useActiveProfile, useIsBusiness } from "@/store/profileStore";

const PERIODS: { id: Period; label: string }[] = [
  { id: "all", label: "All" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

export function Home() {
  const navigate = useNavigate();
  const profile = useActiveProfile();
  const isBusiness = useIsBusiness();

  const [period, setPeriod] = useState<Period>("monthly");
  const summary = useDashboard(period);
  const recent = useTransactions("all", 12);
  const invoices = useInvoiceSummary();

  const income = summary.data?.incomeCents ?? 0;
  const spent = summary.data?.spentCents ?? 0;
  // With nothing posted the ring would divide by zero; show it empty instead.
  const total = income + spent;
  const incomeShare = total > 0 ? Math.round((income / total) * 100) : 0;

  const rows = recent.data ?? [];
  // Both queries have to settle before claiming the ledger is empty, or the empty state
  // flashes over data that is one millisecond behind.
  const isEmpty = !summary.loading && !recent.loading && rows.length === 0;

  // Bars are scaled against the biggest category so the leader fills its track.
  const topCategories = summary.data?.topCategories ?? [];
  const topShare = Math.max(...topCategories.map((c) => c.percent), 1);

  return (
    <div className="flex h-full flex-col gap-6 px-10 pt-8">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-[15px] text-muted">
            {isBusiness ? "Business profile" : "Hello,"}
          </div>
          <h1 className="m-0 font-display text-[32px] leading-[38px] font-bold">
            {profile?.name ?? ""}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <Button onClick={() => navigate("/transactions/new")}>
            <PlusIcon size={18} />
            Add transaction
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-[10px]">
        {PERIODS.map((option) => (
          <Pill
            key={option.id}
            selected={period === option.id}
            onClick={() => setPeriod(option.id)}
          >
            {option.label}
          </Pill>
        ))}
        <div className="ml-2 text-[13px] text-faint">
          Drafts excluded from totals
        </div>
      </div>

      {summary.error ? (
        <ErrorNote message={summary.error} onRetry={summary.reload} />
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={<EmptyLedgerIcon size={44} />}
          title={
            isBusiness ? "No business activity yet" : "Nothing recorded yet"
          }
          body={
            isBusiness
              ? "Log an expense, or send your first invoice — marking it paid posts the income here automatically."
              : "Add a transaction and your income, spending and category breakdown will appear on this dashboard."
          }
          actions={
            <>
              <Button size="lg" onClick={() => navigate("/transactions/new")}>
                Add your first transaction
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate("/settings")}
              >
                Set up categories
              </Button>
            </>
          }
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[420px_1fr] gap-5 pb-8 max-xl:grid-cols-1">
          <div className="scroll-area flex min-h-0 flex-col gap-5">
            <Card className="flex items-center gap-6 rounded-3xl shadow-card">
              <div
                className="flex h-[148px] w-[148px] flex-none items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(var(--brand-primary) 0 ${incomeShare}%, var(--brand-secondary) ${incomeShare}% 100%)`,
                }}
              >
                <div className="flex h-24 w-24 flex-col items-center justify-center gap-[2px] rounded-full bg-surface">
                  <div className="text-[11px] tracking-[0.06em] text-faint uppercase">
                    Net
                  </div>
                  <div className="tnum text-[16px] font-bold">
                    {money(summary.data?.netCents ?? 0)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-[2px]">
                  <div className="flex items-center gap-2 text-[14px] text-muted">
                    <span className="h-[14px] w-1 rounded-full bg-bp" />
                    Income
                  </div>
                  <div className="tnum text-[28px] leading-[34px] font-bold">
                    {money(income)}
                  </div>
                </div>
                <div className="flex flex-col gap-[2px]">
                  <div className="flex items-center gap-2 text-[14px] text-muted">
                    <span className="h-[14px] w-1 rounded-full bg-bs" />
                    Spent
                  </div>
                  <div className="tnum text-[28px] leading-[34px] font-bold">
                    {money(spent)}
                  </div>
                </div>
              </div>
            </Card>

            {isBusiness ? (
              <Card className="flex flex-col gap-[18px] px-7 py-6">
                <div className="flex items-baseline justify-between">
                  <CardTitle>Invoices</CardTitle>
                  <button
                    type="button"
                    onClick={() => navigate("/invoices")}
                    className="text-[14px] font-medium text-link hover:text-ink"
                  >
                    Open
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-[13px] text-muted">Outstanding</div>
                  <div className="tnum text-[26px] font-bold">
                    {money(invoices.data?.outstandingCents ?? 0)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#B8DCF0] px-[14px] py-[6px] text-[13px] font-medium">
                    {invoices.data?.sentCount ?? 0} Sent
                  </span>
                  <span className="rounded-full bg-[#F0C6D9] px-[14px] py-[6px] text-[13px] font-medium">
                    {invoices.data?.overdueCount ?? 0} Overdue
                  </span>
                  <span className="rounded-full bg-[#DADEE5] px-[14px] py-[6px] text-[13px] font-medium">
                    {invoices.data?.draftCount ?? 0} Draft
                  </span>
                </div>
              </Card>
            ) : null}

            <Card className="flex flex-col gap-[14px] px-7 py-6">
              <CardTitle>Top categories</CardTitle>
              {topCategories.length === 0 ? (
                <div className="text-[13px] text-muted">
                  No spending in this period yet.
                </div>
              ) : (
                topCategories.map((cat) => (
                  <div key={cat.categoryId} className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ background: resolveTint(cat.color) }}
                    />
                    <span className="flex-1 truncate text-[14px] font-medium">
                      {cat.name}
                    </span>
                    <span className="h-2 w-[120px] overflow-hidden rounded-full bg-sunken">
                      <span
                        className="block h-2 rounded-full"
                        style={{
                          width: `${Math.max((cat.percent / topShare) * 100, 4)}%`,
                          background: resolveTint(cat.color),
                        }}
                      />
                    </span>
                    <span className="w-[84px] text-right text-[13px] text-muted">
                      {money(cat.totalCents)}
                    </span>
                  </div>
                ))
              )}
            </Card>
          </div>

          <Card className="flex min-h-0 flex-col px-7 pt-6 pb-2">
            <div className="flex items-center justify-between pb-2">
              <CardTitle>Recent transactions</CardTitle>
              <Button
                variant="quiet"
                size="xs"
                className="text-[14px]"
                onClick={() => navigate("/transactions")}
              >
                See all
                <ForwardIcon size={14} />
              </Button>
            </div>
            <div className="scroll-area flex flex-col">
              {recent.loading && rows.length === 0 ? (
                <RowSkeleton />
              ) : (
                rows.map((tx) => (
                  <TransactionListRow
                    key={tx.id}
                    tx={tx}
                    onOpen={(row) => navigate(`/transactions/${row.id}`)}
                  />
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
