import { listClients } from "@/lib/tauri";
import { useQuery } from "@/lib/useQuery";
import type { Client } from "@/lib/types";
import { useProfileStore } from "@/store/profileStore";

export function useClients() {
  const profileId = useProfileStore((s) => s.activeProfileId);
  return useQuery<Client[]>(() => listClients(profileId!), [profileId], {
    enabled: profileId !== null,
  });
}
