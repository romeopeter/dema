import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { InvoiceIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, InitialsTile, tintForIndex } from "@/components/ui/controls";
import { EmptyState, ErrorNote, RowSkeleton } from "@/components/ui/empty-state";
import { TabPill } from "@/components/ui/pill";
import { ClientEditor } from "@/features/clients/components/ClientEditor";
import { useClients } from "@/features/clients/hooks";
import { InvoiceDetailPanel } from "@/features/invoices/components/InvoiceDetailPanel";
import { useInvoice, useInvoices } from "@/features/invoices/hooks";
import { formatDate, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Client, InvoiceDisplayStatus } from "@/lib/types";
import { useActiveProfile } from "@/store/profileStore";

const BADGE_TINT: Record<InvoiceDisplayStatus, string> = {
  paid: "var(--brand-soft)",
  sent: "#B8DCF0",
  overdue: "#F0C6D9",
  draft: "#DADEE5",
};

const CLIENT_COLUMNS = "grid-cols-[1.4fr_1.6fr_1fr_120px]";

export function Invoices() {
  const navigate = useNavigate();
  const profile = useActiveProfile();
  const [params, setParams] = useSearchParams();

  const tab = params.get("tab") === "clients" ? "clients" : "invoices";
  const invoices = useInvoices();
  const clients = useClients();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);

  // Deep links from the notification panel arrive as ?invoice=<id>.
  const requested = Number(params.get("invoice")) || null;
  const list = invoices.data ?? [];
  useEffect(() => {
    if (list.length === 0) return;
    const wanted = requested && list.some((i) => i.id === requested)
      ? requested
      : null;
    setSelectedId((current) =>
      wanted ?? (current && list.some((i) => i.id === current) ? current : list[0].id),
    );
  }, [list, requested]);

  const detail = useInvoice(selectedId);

  const clientRows = clients.data ?? [];
  useEffect(() => {
    if (creatingClient) return;
    setSelectedClient((current) =>
      current ? (clientRows.find((c) => c.id === current.id) ?? null) : null,
    );
  }, [clientRows, creatingClient]);

  function setTab(next: "invoices" | "clients") {
    setParams(next === "clients" ? { tab: "clients" } : {});
  }

  return (
    <div className="flex h-full flex-col gap-[22px] px-10 py-8">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-[15px] text-muted">{profile?.name}</div>
          <h1 className="m-0 font-display text-[32px] leading-[38px] font-bold">
            {tab === "clients" ? "Clients" : "Invoices"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
            <TabPill
              selected={tab === "invoices"}
              onClick={() => setTab("invoices")}
            >
              Invoices
            </TabPill>
            <TabPill
              selected={tab === "clients"}
              onClick={() => setTab("clients")}
            >
              Clients
            </TabPill>
          </div>
          <Button
            onClick={() => {
              if (tab === "clients") {
                setSelectedClient(null);
                setCreatingClient(true);
              } else {
                navigate("/invoices/new");
              }
            }}
          >
            <PlusIcon size={18} />
            {tab === "clients" ? "New client" : "New invoice"}
          </Button>
        </div>
      </header>

      {invoices.error ? (
        <ErrorNote message={invoices.error} onRetry={invoices.reload} />
      ) : null}

      {tab === "invoices" ? (
        list.length === 0 && !invoices.loading ? (
          <EmptyState
            icon={<InvoiceIcon size={40} />}
            title="No invoices yet"
            body="Raise your first invoice. When you mark it paid, DEXT posts the matching income transaction for you."
            actions={
              <Button size="lg" onClick={() => navigate("/invoices/new")}>
                Create an invoice
              </Button>
            }
          />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[460px_1fr] gap-5 pb-8 max-xl:grid-cols-1">
            <Card className="scroll-area flex min-h-0 flex-col gap-1 p-3">
              {invoices.loading && list.length === 0 ? (
                <RowSkeleton rows={4} />
              ) : (
                list.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    onClick={() => setSelectedId(invoice.id)}
                    className={cn(
                      "flex flex-col gap-[6px] rounded-[20px] px-[18px] py-4 text-left transition-all duration-200 ease-[var(--ease-standard)]",
                      invoice.id === selectedId
                        ? "bg-divider shadow-[inset_0_0_0_1.5px_var(--brand-primary)]"
                        : "bg-surface hover:bg-subtle",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[16px] font-semibold">
                        #{invoice.invoiceNumber}
                      </span>
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.04em] uppercase"
                        style={{ background: BADGE_TINT[invoice.displayStatus] }}
                      >
                        {invoice.displayStatus}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[14px] text-muted">
                        {invoice.clientName}
                      </span>
                      <span className="tnum text-[18px] font-bold">
                        {money(invoice.totalAmountCents)}
                      </span>
                    </div>
                    <div className="text-[13px] text-faint">
                      Issued {formatDate(invoice.issueDate)} · due{" "}
                      {formatDate(invoice.dueDate)}
                    </div>
                  </button>
                ))
              )}
            </Card>

            <InvoiceDetailPanel invoice={detail.data} loading={detail.loading} />
          </div>
        )
      ) : clientRows.length === 0 && !creatingClient && !clients.loading ? (
        <EmptyState
          icon={<InvoiceIcon size={40} />}
          title="No clients yet"
          body="Add a client once and they are ready to pick on every invoice you raise."
          actions={
            <Button size="lg" onClick={() => setCreatingClient(true)}>
              Add a client
            </Button>
          }
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_400px] gap-5 pb-8 max-xl:grid-cols-1">
          <Card className="flex min-h-0 flex-col px-7 pt-6 pb-2">
            <div
              className={`grid ${CLIENT_COLUMNS} gap-4 pb-[14px] text-[12px] font-semibold tracking-[0.06em] text-faint uppercase`}
            >
              <div>Client</div>
              <div>Email</div>
              <div>Phone</div>
              <div className="text-right">Invoiced</div>
            </div>
            <div className="scroll-area flex flex-col">
              {clientRows.map((client, index) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    setCreatingClient(false);
                    setSelectedClient(client);
                  }}
                  className={cn(
                    `grid ${CLIENT_COLUMNS} gap-4 rounded-[14px] border-b border-divider px-2 py-3 text-left`,
                    selectedClient?.id === client.id
                      ? "bg-divider"
                      : "bg-surface hover:bg-subtle",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <InitialsTile
                      name={client.name}
                      tint={tintForIndex(index)}
                    />
                    <span className="truncate text-[15px] font-medium">
                      {client.name}
                    </span>
                  </span>
                  <span className="self-center truncate text-[14px] text-muted">
                    {client.email ?? "—"}
                  </span>
                  <span className="self-center truncate text-[14px] text-muted">
                    {client.phone ?? "—"}
                  </span>
                  <span className="tnum self-center text-right text-[16px] font-bold">
                    {money(client.invoicedCents)}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <ClientEditor
            client={creatingClient ? null : selectedClient}
            onDone={(client) => {
              setCreatingClient(false);
              setSelectedClient(client);
            }}
          />
        </div>
      )}
    </div>
  );
}
