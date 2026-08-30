import { categoryReport } from "@/lib/tauri";
import { useQuery } from "@/lib/useQuery";
import type { Report } from "@/lib/types";
import { useProfileStore } from "@/store/profileStore";

export function useReport(fromDate: string, toDate: string) {
  const profileId = useProfileStore((s) => s.activeProfileId);
  return useQuery<Report>(
    () => categoryReport(profileId!, fromDate, toDate),
    [profileId, fromDate, toDate],
    { enabled: profileId !== null },
  );
}
