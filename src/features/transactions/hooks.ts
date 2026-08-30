import { useMemo } from "react";

import {
  dashboardSummary,
  listCategories,
  listTransactions,
} from "@/lib/tauri";
import { useQuery } from "@/lib/useQuery";
import type {
  Category,
  DashboardSummary,
  Period,
  TransactionFilter,
  TransactionRow,
} from "@/lib/types";
import { useProfileStore } from "@/store/profileStore";

export function useTransactions(
  filter: TransactionFilter = "all",
  limit?: number,
) {
  const profileId = useProfileStore((s) => s.activeProfileId);
  return useQuery<TransactionRow[]>(
    () => listTransactions(profileId!, filter, limit),
    [profileId, filter, limit],
    { enabled: profileId !== null },
  );
}

export function useDashboard(period: Period) {
  const profileId = useProfileStore((s) => s.activeProfileId);
  return useQuery<DashboardSummary>(
    () => dashboardSummary(profileId!, period),
    [profileId, period],
    { enabled: profileId !== null },
  );
}

export function useCategories() {
  const profileId = useProfileStore((s) => s.activeProfileId);
  const query = useQuery<Category[]>(
    () => listCategories(profileId!),
    [profileId],
    { enabled: profileId !== null },
  );

  // What the picker may offer: never an archived category, never one this profile hid.
  const selectable = useMemo(
    () => (query.data ?? []).filter((c) => !c.isDeleted && !c.isHidden),
    [query.data],
  );

  return { ...query, all: query.data ?? [], selectable };
}
