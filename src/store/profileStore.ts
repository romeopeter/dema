import { create } from "zustand";

import { createProfile, listProfiles } from "@/lib/tauri";
import type { Profile, ProfileType } from "@/lib/types";
import { useSettingsStore } from "@/store/settingsStore";

interface ProfileState {
  profiles: Profile[];
  activeProfileId: number | null;
  loaded: boolean;

  load: () => Promise<void>;
  setActive: (id: number) => Promise<void>;
  addProfile: (type: ProfileType, name: string) => Promise<Profile>;
}

const ACTIVE_KEY = "active_profile_id";

/**
 * The active profile scopes every query in the app. Switching it is the only thing that
 * changes which books you are looking at, and it happens in Settings alone — the sidebar
 * chip navigates there rather than switching in place.
 */
export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  activeProfileId: null,
  loaded: false,

  load: async () => {
    const profiles = await listProfiles();
    const settings = useSettingsStore.getState();
    if (!settings.loaded) await settings.load();

    const saved = Number(useSettingsStore.getState().values[ACTIVE_KEY]);
    const active =
      profiles.find((p) => p.id === saved)?.id ?? profiles[0]?.id ?? null;

    set({ profiles, activeProfileId: active, loaded: true });
  },

  setActive: async (id) => {
    set({ activeProfileId: id });
    await useSettingsStore.getState().save({ [ACTIVE_KEY]: String(id) });
  },

  addProfile: async (type, name) => {
    const profile = await createProfile(type, name);
    set({ profiles: [...get().profiles, profile] });
    await get().setActive(profile.id);
    return profile;
  },
}));

/** The active profile row, or null before the first load finishes. */
export function useActiveProfile(): Profile | null {
  return useProfileStore(
    (s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? null,
  );
}

/**
 * Invoices, Clients and the brand theme are business-only. Every gate in the app reads
 * this one predicate rather than re-deriving it.
 */
export function useIsBusiness(): boolean {
  return useProfileStore(
    (s) =>
      s.profiles.find((p) => p.id === s.activeProfileId)?.type === "business",
  );
}
