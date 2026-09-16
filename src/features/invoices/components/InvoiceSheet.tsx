import { formatDate, moneyExact, taxRateLabel } from "@/lib/format";
import type { InvoiceDocument } from "@/lib/types";

/**
 * The printable A4 invoice.
 *
 * Read-only by design. The prototype made every field `contenteditable`, which its own
 * handoff calls a prototype convenience — typing into the paper would edit nothing that
 * survives a reload. Figures come from the invoice record, issuer details from the
 * business profile, and both are edited in their own forms.
 *
 * Layout is fixed at A4 (794px at 96dpi) so what is on screen is what prints.
 */
export function InvoiceSheet({ doc }: { doc: InvoiceDocument }) {
  const { invoice, items, client, business, businessName } = doc;
  const show = invoice.show;

  const footer = (
    <div className="invoice-footer grid grid-cols-[1fr_auto_1fr] items-start gap-6 border-t-[1.5px] border-line bg-white px-12 pt-[14px] pb-[18px]">
      <div className="flex min-w-0 flex-col gap-[2px]">
        <div className="text-[10.5px] font-bold tracking-[0.08em] uppercase">
          {businessName}
        </div>
        <div className="text-[11.5px] leading-4 text-muted">
          {business.address ?? "—"}
        </div>
      </div>
      <div className="flex flex-col gap-[2px]">
        <div className="text-[11.5px] text-muted">{business.email ?? "—"}</div>
        <div className="tnum text-[11.5px] text-muted">
          {business.phone ?? "—"}
        </div>
      </div>
      <div className="text-right text-[11.5px] leading-4 text-muted">
        {business.rcNumber || business.tin
          ? `Registered in Nigeria with the Corporate Affairs Commission${
              business.rcNumber ? ` under RC ${business.rcNumber}` : ""
            }.${business.tin ? ` TIN ${business.tin}.` : ""}`
          : ""}
      </div>
    </div>
  );

  return (
    <div className="invoice-sheet w-[794px] bg-white text-ink shadow-card print:shadow-none">
      <div className="invoice-body pb-3">
        <header className="flex items-start gap-7 border-b-[1.5px] border-line bg-[#F7F8FA] px-12 pt-[30px] pb-[22px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
            <div className="font-display text-[36px] leading-none font-extrabold tracking-[-0.01em]">
              INVOICE
            </div>
            <div className="flex items-center gap-[9px]">
              <span className="text-[13px] text-muted">Invoice Number</span>
              <span className="tnum rounded-lg bg-bp-soft px-[11px] py-1 text-[13px] font-semibold">
                #{invoice.invoiceNumber}
              </span>
            </div>
          </div>
          <div className="flex flex-none flex-col items-end gap-[11px]">
            <div className="h-[92px] w-[92px] overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1.5px_#E4E6EB]">
              {business.logoDataUrl ? (
                <img
                  src={business.logoDataUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] text-faint">
                  Logo
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-[2px]">
              <div className="text-[12.5px] text-muted">
                {business.email ?? "—"}
              </div>
              <div className="tnum text-[12.5px] text-muted">
                {business.phone ?? "—"}
              </div>
            </div>
          </div>
        </header>

        <section className="grid break-inside-avoid grid-cols-2 gap-x-9 gap-y-5 px-12 pt-6">
          <div className="flex min-w-0 flex-col gap-[5px]">
            <div className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
              Billed by
            </div>
            <div className="font-display text-[15px] font-bold">
              {businessName}
            </div>
            <div className="text-[13px] leading-[19px] whitespace-pre-line text-muted">
              {business.address ?? "—"}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-[5px]">
            <div className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
              Billed to
            </div>
            <div className="font-display text-[15px] font-bold">{client.name}</div>
            <div className="text-[13px] leading-[19px] whitespace-pre-line text-muted">
              {client.address ?? "—"}
            </div>
            {client.email || client.phone ? (
              <div className="text-[13px] leading-[19px] text-muted">
                {[client.email, client.phone].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </div>

          <div className="flex gap-8">
            <Meta label="Date issued" value={formatDate(invoice.issueDate)} tnum />
            <Meta label="Due date" value={formatDate(invoice.dueDate)} tnum />
            <Meta label="Currency" value="NGN ₦" />
          </div>
        </section>

        <section className="px-12 pt-[22px]">
          <div className="grid grid-cols-[1fr_54px_70px_124px] items-center gap-x-[14px] border-b-[1.5px] border-ink pb-[9px]">
            <Th>Item name</Th>
            <Th right>Qty</Th>
            <Th right>Tax</Th>
            <Th right>Amount</Th>
          </div>

          {items.map((item) => (
            <div
              key={item.id}
              className="grid break-inside-avoid grid-cols-[1fr_54px_70px_124px] items-center gap-x-[14px] border-b border-divider py-[10px]"
            >
              <div className="text-[14px] font-medium">{item.description}</div>
              <div className="tnum text-right text-[14px]">{item.quantity}</div>
              <div className="tnum text-right text-[14px] text-muted">
                {taxRateLabel(item.taxRateBp)}
              </div>
              <div className="tnum text-right text-[14px] font-semibold">
                {moneyExact(item.amountCents)}
              </div>
            </div>
          ))}

          <div className="mt-[18px] flex break-inside-avoid justify-end">
            <div className="flex w-[300px] flex-col">
              {show.subtotal ? (
                <TotalRow label="Subtotal" value={moneyExact(invoice.subtotalCents)} />
              ) : null}
              {show.discount ? (
                <TotalRow
                  label="Discount"
                  value={`−${moneyExact(invoice.discountCents)}`}
                />
              ) : null}
              {show.vat ? (
                <TotalRow
                  label={`VAT ${taxRateLabel(invoice.vatRateBp)}`}
                  value={moneyExact(invoice.vatCents)}
                />
              ) : null}
              {show.paid ? (
                <TotalRow
                  label="Amount paid"
                  value={moneyExact(invoice.amountPaidCents)}
                />
              ) : null}
              {show.balance ? (
                <TotalRow
                  label="Balance due"
                  value={moneyExact(invoice.balanceDueCents)}
                />
              ) : null}
              {show.grand ? (
                <div className="mt-[3px] flex items-center justify-between gap-5 border-t-[1.5px] border-ink pt-[11px]">
                  <span className="font-display text-[15px] font-bold">
                    Grand total
                  </span>
                  <span className="tnum text-[20px] font-bold">
                    {moneyExact(invoice.totalAmountCents)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="px-12 pt-5">
          <div className="flex break-inside-avoid flex-col gap-[10px] rounded-[4px_12px_12px_4px] border-l-[3px] border-bp bg-[#F7F8FA] px-[18px] py-[14px]">
            <div className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
              Payment details
            </div>
            <div className="text-[13px] leading-[19px] text-muted">
              {business.paymentInstruction ??
                "Transfer the amount to the business account below. Please include the invoice number as your payment reference."}
            </div>
            <div className="flex flex-wrap items-start gap-6">
              <PayField label="Bank" value={business.bankName} />
              <PayField label="Account name" value={business.accountName} />
              <PayField label="Account number" value={business.accountNumber} tnum />
            </div>
          </div>
        </section>

        {show.notes && invoice.notes ? (
          <section className="flex break-inside-avoid flex-col gap-[6px] px-12 pt-[18px]">
            <div className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
              Notes
            </div>
            <div className="max-w-[540px] text-[13px] leading-[19px] text-pretty text-muted">
              {invoice.notes}
            </div>
          </section>
        ) : null}

        {show.signature ? (
          <section className="flex break-inside-avoid justify-end px-12 pt-5">
            <div className="flex w-[240px] flex-col items-end gap-[5px]">
              <div className="flex h-[54px] w-full items-end justify-end">
                {business.signatureDataUrl ? (
                  <img
                    src={business.signatureDataUrl}
                    alt=""
                    className="max-h-[54px] w-full object-contain object-right"
                  />
                ) : null}
              </div>
              <div className="h-px w-full bg-line" />
              <div className="font-display text-[14px] font-bold">
                {business.signerName ?? businessName}
              </div>
              <div className="text-[12px] text-muted">
                {business.signerRole ?? ""}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {footer}
    </div>
  );
}

function Meta({
  label,
  value,
  tnum,
}: {
  label: string;
  value: string;
  tnum?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[3px]">
      <div className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
        {label}
      </div>
      <div className={`text-[14px] font-semibold ${tnum ? "tnum" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Th({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <div
      className={`text-[11px] font-semibold tracking-[0.04em] text-muted uppercase ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-divider py-[7px]">
      <span className="text-[13.5px] text-muted">{label}</span>
      <span className="tnum text-[14px] font-medium">{value}</span>
    </div>
  );
}

function PayField({
  label,
  value,
  tnum,
}: {
  label: string;
  value: string | null;
  tnum?: boolean;
}) {
  return (
    <div className="flex flex-col gap-px">
      <span className="text-[10.5px] font-semibold tracking-[0.06em] text-faint uppercase">
        {label}
      </span>
      <span
        className={`text-[13.5px] font-semibold ${tnum ? "tnum tracking-[0.02em]" : ""} ${
          value ? "" : "text-faint"
        }`}
      >
        {value ?? "Not set"}
      </span>
    </div>
  );
}
