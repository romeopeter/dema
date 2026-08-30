import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";

import { CalendarIcon, DownloadIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/controls";
import { ErrorNote, RowSkeleton } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { useReport } from "@/features/reports/hooks";
import {
  formatDateRange,
  money,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  today,
} from "@/lib/format";
import { mutate } from "@/lib/mutate";
import { exportReportCsv, exportReportPdf } from "@/lib/tauri";
import { resolveTint } from "@/lib/theme";
import { announce } from "@/store/uiStore";
import { useActiveProfile } from "@/store/profileStore";

type RangeId = "year" | "quarter" | "month";

const RANGES: { id: RangeId; label: string; from: () => string }[] = [
  { id: "year", label: "This year", from: () => startOfYear() },
  { id: "quarter", label: "This quarter", from: () => startOfQuarter() },
  { id: "month", label: "This month", from: () => startOfMonth() },
];

const COLUMNS = "grid-cols-[1.6fr_1fr_1fr_1fr]";

export function Reports() {
  const profile = useActiveProfile();
  const [range, setRange] = useState<RangeId>("year");
  const [exporting, setExporting] = useState(false);

  const fromDate = RANGES.find((r) => r.id === range)!.from();
  const toDate = today();
  const report = useReport(fromDate, toDate);

  const isBusiness = profile?.type === "business";
  const income = report.data?.incomeCents ?? 0;
  const expenses = report.data?.expenseCents ?? 0;
  const deductible = report.data?.deductibleCents ?? 0;
  // A business is taxed on what it can deduct; a personal book nets off everything.
  const net = income - (isBusiness ? deductible : expenses);

  async function exportAs(format: "csv" | "pdf") {
    if (!profile) return;
    const suggested = `dext-report-${fromDate}-to-${toDate}.${format}`;
    const path = await save({
      defaultPath: suggested,
      filters: [
        {
          name: format === "csv" ? "CSV spreadsheet" : "PDF document",
          extensions: [format],
        },
      ],
    });
    if (!path) return; // The person cancelled the dialog.

    setExporting(true);
    const args = { profileId: profile.id, fromDate, toDate, path };
    const written = await mutate(() =>
      format === "csv" ? exportReportCsv(args) : exportReportPdf(args),
    );
    setExporting(false);
    if (written) announce("success", `Saved to ${written}`);
  }

  const rows = report.data?.rows ?? [];

  return (
    <div className="flex h-full flex-col gap-[22px] px-10 py-8">
      <header className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-[15px] text-muted">
            {isBusiness ? "Business" : "Personal"} profile
          </div>
          <h1 className="m-0 font-display text-[32px] leading-[38px] font-bold">
            Reports
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="quiet"
            size="sm"
            className="text-[15px]"
            disabled={exporting}
            onClick={() => exportAs("csv")}
          >
            <DownloadIcon size={18} />
            Export CSV
          </Button>
          <Button size="sm" disabled={exporting} onClick={() => exportAs("pdf")}>
            Export PDF
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 rounded-full border border-line bg-surface px-5 py-[14px] text-[15px]">
          <CalendarIcon size={18} className="text-muted" />
          {formatDateRange(fromDate, toDate)}
        </div>
        {RANGES.map((option) => (
          <Pill
            key={option.id}
            selected={range === option.id}
            onClick={() => setRange(option.id)}
          >
            {option.label}
          </Pill>
        ))}
      </div>

      {report.error ? (
        <ErrorNote message={report.error} onRetry={report.reload} />
      ) : null}

      <div className="grid grid-cols-3 gap-5">
        <Card className="flex flex-col gap-[6px] px-7 py-6">
          <div className="text-[14px] text-muted">Gross income</div>
          <div className="tnum text-[28px] font-bold">{money(income)}</div>
        </Card>
        <Card className="flex flex-col gap-[6px] px-7 py-6">
          <div className="text-[14px] text-muted">
            {isBusiness ? "Deductible expenses" : "Total expenses"}
          </div>
          <div className="tnum text-[28px] font-bold">
            {money(isBusiness ? deductible : expenses)}
          </div>
        </Card>
        <Card className="flex flex-col gap-[6px] bg-bp-soft px-7 py-6 shadow-none">
          <div className="text-[14px] text-ink/70">
            {isBusiness ? "Taxable profit" : "Net"}
          </div>
          <div className="tnum text-[28px] font-bold">{money(net)}</div>
        </Card>
      </div>

      <Card className="mb-8 flex min-h-0 flex-1 flex-col px-7 pt-6 pb-2">
        <div className="flex items-center justify-between pb-4">
          <CardTitle>Category summary</CardTitle>
          <div className="text-[13px] text-faint">
            Drafts excluded · {report.data?.transactionCount ?? 0} transactions
          </div>
        </div>

        <div
          className={`grid ${COLUMNS} gap-4 rounded-xl bg-divider px-1 py-3 text-[12px] font-semibold tracking-[0.06em] text-muted uppercase`}
        >
          <div className="pl-4">Category</div>
          <div className="text-right">Type</div>
          <div className="text-right">Transactions</div>
          <div className="pr-4 text-right">Total</div>
        </div>

        <div className="scroll-area">
          {report.loading && rows.length === 0 ? (
            <RowSkeleton rows={6} />
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-[14px] text-muted">
              Nothing posted in this period. Post a draft, or widen the range.
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={`${row.categoryId}-${row.kind}`}
                className={`grid ${COLUMNS} items-center gap-4 border-b border-divider px-1 py-4`}
              >
                <div className="flex items-center gap-3 pl-4">
                  <span
                    className="h-[10px] w-[10px] flex-none rounded-full"
                    style={{ background: resolveTint(row.color) }}
                  />
                  <span className="truncate text-[15px] font-medium">
                    {row.name}
                  </span>
                  {row.kind === "expense" && row.taxDeductible ? (
                    <span className="rounded-full bg-divider px-2 py-[2px] text-[11px] font-semibold text-muted">
                      Deductible
                    </span>
                  ) : null}
                </div>
                <div className="text-right text-[14px] text-muted">
                  {row.kind === "income" ? "Income" : "Expense"}
                </div>
                <div className="text-right text-[14px] text-muted">
                  {row.transactionCount}
                </div>
                <div className="tnum pr-4 text-right text-[17px] font-bold">
                  {money(row.totalCents)}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
