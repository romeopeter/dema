import {
  getInvoice,
  invoiceSummary,
  listInvoices,
  nextInvoiceNumber,
} from "@/lib/tauri";
import { useQuery } from "@/lib/useQuery";
import type { Invoice, InvoiceDetail, InvoiceSummary } from "@/lib/types";
import { useProfileStore } from "@/store/profileStore";

export function useInvoices() {
  const profileId = useProfileStore((s) => s.activeProfileId);
  return useQuery<Invoice[]>(() => listInvoices(profileId!), [profileId], {
    enabled: profileId !== null,
  });
}

export function useInvoice(id: number | null) {
  return useQuery<InvoiceDetail>(() => getInvoice(id!), [id], {
    enabled: id !== null,
  });
}

export function useInvoiceSummary() {
  const profileId = useProfileStore((s) => s.activeProfileId);
  return useQuery<InvoiceSummary>(
    () => invoiceSummary(profileId!),
    [profileId],
    { enabled: profileId !== null },
  );
}

export function useNextInvoiceNumber() {
  const profileId = useProfileStore((s) => s.activeProfileId);
  return useQuery<string>(() => nextInvoiceNumber(profileId!), [profileId], {
    enabled: profileId !== null,
  });
}
