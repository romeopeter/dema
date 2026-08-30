/**
 * These mirror the `serde` structs in `src-tauri/src/models` exactly. If a Rust struct
 * changes, change it here in the same commit — `lib/tauri.ts` is typed against these, so
 * every call site breaks at compile time rather than at runtime.
 */

export type ProfileType = "personal" | "business";
export type Kind = "income" | "expense";
export type PaymentType = "cash" | "card" | "check";
export type TransactionStatus = "draft" | "posted";
export type InvoiceStatus = "draft" | "sent" | "paid";
export type InvoiceDisplayStatus = InvoiceStatus | "overdue";
export type Period = "all" | "daily" | "weekly" | "monthly" | "yearly";
export type TransactionFilter = "all" | "posted" | "drafts";

export interface Profile {
  id: number;
  type: ProfileType;
  name: string;
  createdAt: string;
}

export interface Category {
  id: number;
  profileId: number | null;
  profileType: ProfileType | null;
  name: string;
  icon: string;
  color: string;
  kind: Kind;
  isBuiltin: boolean;
  taxDeductible: boolean;
  isDeleted: boolean;
  sortOrder: number;
  isHidden: boolean;
  transactionCount: number;
}

export interface NewCategory {
  profileId: number;
  name: string;
  icon: string;
  color: string;
  kind: Kind;
  taxDeductible: boolean;
}

export interface TransactionRow {
  id: number;
  profileId: number;
  amountCents: number;
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  paymentType: PaymentType;
  status: TransactionStatus;
  kind: Kind;
  date: string;
  note: string | null;
  invoiceId: number | null;
  invoiceNumber: string | null;
}

export interface NewTransaction {
  profileId: number;
  amountCents: number;
  categoryId: number;
  paymentType: PaymentType;
  status: TransactionStatus;
  kind: Kind;
  date: string;
  note?: string | null;
}

export interface CategoryTotal {
  categoryId: number;
  name: string;
  color: string;
  icon: string;
  kind: Kind;
  totalCents: number;
  percent: number;
}

export interface DashboardSummary {
  incomeCents: number;
  spentCents: number;
  netCents: number;
  draftCount: number;
  fromDate: string | null;
  toDate: string | null;
  topCategories: CategoryTotal[];
}

export interface Client {
  id: number;
  profileId: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  invoicedCents: number;
  outstandingCents: number;
}

export interface ClientInput {
  profileId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface Invoice {
  id: number;
  profileId: number;
  clientId: number;
  clientName: string;
  clientAddress: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  displayStatus: InvoiceDisplayStatus;
  subtotalCents: number;
  vatRateBp: number;
  vatCents: number;
  totalAmountCents: number;
  notes: string | null;
  paidAt: string | null;
  transactionId: number | null;
}

export interface LineItem {
  id: number;
  invoiceId: number;
  description: string;
  quantity: number;
  unitPriceCents: number;
  position: number;
  amountCents: number;
}

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

/** `InvoiceDetail` flattens `Invoice` on the Rust side, so it is Invoice + items. */
export type InvoiceDetail = Invoice & { items: LineItem[] };

export interface InvoiceInput {
  profileId: number;
  clientId: number;
  issueDate: string;
  dueDate: string;
  status: "draft" | "sent";
  notes?: string | null;
  vatRateBp?: number | null;
  items: LineItemInput[];
}

export interface InvoiceSummary {
  outstandingCents: number;
  draftCount: number;
  sentCount: number;
  overdueCount: number;
  paidCount: number;
}

export interface ReportRow {
  categoryId: number;
  name: string;
  color: string;
  kind: Kind;
  taxDeductible: boolean;
  transactionCount: number;
  totalCents: number;
}

export interface Report {
  profileId: number;
  profileName: string;
  profileType: ProfileType;
  fromDate: string;
  toDate: string;
  incomeCents: number;
  expenseCents: number;
  deductibleCents: number;
  transactionCount: number;
  rows: ReportRow[];
}

/** The shape `AppError` serialises to. */
export interface AppError {
  kind:
    | "database"
    | "migration"
    | "not_found"
    | "validation"
    | "conflict"
    | "io";
  message: string;
  detail: string | null;
}

export type Settings = Record<string, string>;
