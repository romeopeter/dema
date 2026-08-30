import { invoke } from "@tauri-apps/api/core";

import type {
  AppError,
  Category,
  Client,
  ClientInput,
  DashboardSummary,
  Invoice,
  InvoiceDetail,
  InvoiceInput,
  InvoiceSummary,
  NewCategory,
  NewTransaction,
  PaymentType,
  Period,
  Profile,
  ProfileType,
  Report,
  Settings,
  TransactionFilter,
  TransactionRow,
} from "./types";

/**
 * The only module in the app that calls `invoke`. Every Rust command gets exactly one
 * wrapper here, so a signature change on the Rust side surfaces as a type error at the
 * call sites instead of an undefined at runtime.
 */

/** Narrows the unknown a rejected `invoke` throws into our serialised `AppError`. */
export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "message" in value
  );
}

export function errorMessage(value: unknown): string {
  if (isAppError(value)) return value.message;
  if (value instanceof Error) return value.message;
  return "Something went wrong.";
}

/* ---------------------------------------------------------------- profiles */

export const listProfiles = () => invoke<Profile[]>("list_profiles");

export const createProfile = (profileType: ProfileType, name: string) =>
  invoke<Profile>("create_profile", { profileType, name });

export const renameProfile = (id: number, name: string) =>
  invoke<Profile>("rename_profile", { id, name });

/* -------------------------------------------------------------- categories */

export const listCategories = (profileId: number) =>
  invoke<Category[]>("list_categories", { profileId });

export const createCategory = (input: NewCategory) =>
  invoke<Category>("create_category", { input });

export const updateCategory = (args: {
  id: number;
  profileId: number;
  name: string;
  icon: string;
  color: string;
  taxDeductible: boolean;
}) => invoke<Category>("update_category", args);

export const deleteCategory = (id: number, profileId: number) =>
  invoke<Category>("delete_category", { id, profileId });

export const restoreCategory = (id: number, profileId: number) =>
  invoke<Category>("restore_category", { id, profileId });

export const setCategoryHidden = (
  id: number,
  profileId: number,
  hidden: boolean,
) => invoke<Category>("set_category_hidden", { id, profileId, hidden });

/* ------------------------------------------------------------ transactions */

export const listTransactions = (
  profileId: number,
  filter: TransactionFilter = "all",
  limit?: number,
) =>
  invoke<TransactionRow[]>("list_transactions", {
    profileId,
    filter,
    limit: limit ?? null,
  });

export const createTransaction = (input: NewTransaction) =>
  invoke<TransactionRow>("create_transaction", { input });

export const updateTransaction = (id: number, input: NewTransaction) =>
  invoke<TransactionRow>("update_transaction", { id, input });

export const postTransaction = (id: number) =>
  invoke<TransactionRow>("post_transaction", { id });

export const deleteTransaction = (id: number) =>
  invoke<void>("delete_transaction", { id });

export const dashboardSummary = (profileId: number, period: Period) =>
  invoke<DashboardSummary>("dashboard_summary", { profileId, period });

/* ----------------------------------------------------------------- clients */

export const listClients = (profileId: number) =>
  invoke<Client[]>("list_clients", { profileId });

export const createClient = (input: ClientInput) =>
  invoke<Client>("create_client", { input });

export const updateClient = (id: number, input: ClientInput) =>
  invoke<Client>("update_client", { id, input });

export const deleteClient = (id: number) =>
  invoke<void>("delete_client", { id });

/* ---------------------------------------------------------------- invoices */

export const listInvoices = (profileId: number) =>
  invoke<Invoice[]>("list_invoices", { profileId });

export const getInvoice = (id: number) =>
  invoke<InvoiceDetail>("get_invoice", { id });

export const nextInvoiceNumber = (profileId: number) =>
  invoke<string>("next_invoice_number", { profileId });

export const createInvoice = (input: InvoiceInput) =>
  invoke<InvoiceDetail>("create_invoice", { input });

export const updateInvoice = (id: number, input: InvoiceInput) =>
  invoke<InvoiceDetail>("update_invoice", { id, input });

export const sendInvoice = (id: number) =>
  invoke<InvoiceDetail>("send_invoice", { id });

export const markInvoicePaid = (
  id: number,
  paymentType: PaymentType = "check",
  paidOn?: string,
) =>
  invoke<InvoiceDetail>("mark_invoice_paid", {
    id,
    paymentType,
    paidOn: paidOn ?? null,
  });

export const reopenInvoice = (id: number) =>
  invoke<InvoiceDetail>("reopen_invoice", { id });

export const deleteInvoice = (id: number) =>
  invoke<void>("delete_invoice", { id });

export const invoiceSummary = (profileId: number) =>
  invoke<InvoiceSummary>("invoice_summary", { profileId });

/* ----------------------------------------------------------------- reports */

export const categoryReport = (
  profileId: number,
  fromDate: string,
  toDate: string,
) => invoke<Report>("category_report", { profileId, fromDate, toDate });

export const exportReportCsv = (args: {
  profileId: number;
  fromDate: string;
  toDate: string;
  path: string;
}) => invoke<string>("export_report_csv", args);

export const exportReportPdf = (args: {
  profileId: number;
  fromDate: string;
  toDate: string;
  path: string;
}) => invoke<string>("export_report_pdf", args);

/* ---------------------------------------------------------------- settings */

export const getSettings = () => invoke<Settings>("get_settings");

export const setSettings = (values: Settings) =>
  invoke<Settings>("set_settings", { values });
