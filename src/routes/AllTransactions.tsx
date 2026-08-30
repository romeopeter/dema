import { useNavigate, useSearchParams } from "react-router-dom";

import { BackIcon, EmptyLedgerIcon } from "@/components/icons";
import { RoundButton } from "@/components/ui/button";
import { Card } from "@/components/ui/controls";
import { EmptyState, ErrorNote, RowSkeleton } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { TransactionListRow } from "@/features/transactions/components/TransactionListRow";
import { useTransactions } from "@/features/transactions/hooks";
import { pluralise } from "@/lib/format";
import type { TransactionFilter } from "@/lib/types";
import { useActiveProfile } from "@/store/profileStore";

const FILTERS: { id: TransactionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "posted", label: "Posted" },
  { id: "drafts", label: "Drafts" },
];

function isFilter(value: string | null): value is TransactionFilter {
  return value === "all" || value === "posted" || value === "drafts";
}

export function AllTransactions() {
  const navigate = useNavigate();
  const profile = useActiveProfile();

  // The filter lives in the URL so the notification panel can deep-link to Drafts.
  const [params, setParams] = useSearchParams();
  const raw = params.get("filter");
  const filter: TransactionFilter = isFilter(raw) ? raw : "all";

  const query = useTransactions(filter);
  const rows = query.data ?? [];

  return (
    <div className="flex h-full flex-col gap-[22px] px-10 py-8">
      <div className="flex items-center gap-4">
        <RoundButton aria-label="Back" onClick={() => navigate("/")}>
          <BackIcon />
        </RoundButton>
        <div className="flex flex-col gap-[2px]">
          <h1 className="m-0 font-display text-[28px] leading-[34px] font-bold">
            All transactions
          </h1>
          <div className="text-[14px] text-muted">
            {profile?.name} · {pluralise(rows.length, "record")} shown
          </div>
        </div>
        <div className="ml-auto flex gap-[10px]">
          {FILTERS.map((option) => (
            <Pill
              key={option.id}
              selected={filter === option.id}
              onClick={() => setParams({ filter: option.id })}
            >
              {option.label}
            </Pill>
          ))}
        </div>
      </div>

      {query.error ? (
        <ErrorNote message={query.error} onRetry={query.reload} />
      ) : null}

      {!query.loading && rows.length === 0 ? (
        <EmptyState
          icon={<EmptyLedgerIcon size={44} />}
          title={
            filter === "drafts"
              ? "No drafts waiting"
              : filter === "posted"
                ? "Nothing posted yet"
                : "Nothing recorded yet"
          }
          body={
            filter === "drafts"
              ? "Drafts you save without posting collect here, out of every total until you post them."
              : "Transactions you record show up here, newest first."
          }
        />
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col px-7 pt-3 pb-2">
          <div className="scroll-area flex flex-col">
            {query.loading && rows.length === 0 ? (
              <RowSkeleton rows={7} />
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
      )}
    </div>
  );
}
