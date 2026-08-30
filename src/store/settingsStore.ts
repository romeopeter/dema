import { create } from "zustand";

import { getSettings, setSettings } from "@/lib/tauri";
import { FACTORY, type ThemeChoice } from "@/lib/theme";
import type { Settings } from "@/lib/types";

interface SettingsState {
  values: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  save: (patch: Settings) => Promise<void>;
}

/**
 * Preferences live in SQLite, not localStorage: the handoff lists persistence of the
 * profile choice and brand theme as open work, and the database is the one store that
 * survives a reinstall of the webview cache.
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  values: {},
  loaded: false,

  load: async () => {
    const values = await getSettings();
    set({ values, loaded: true });
  },

  save: async (patch) => {
    // Optimistic: the brand theme should repaint as the user types a hex, not a round
    // trip later. The write still wins if it disagrees.
    set({ values: { ...get().values, ...patch } });
    const values = await setSettings(patch);
    set({ values });
  },
}));

export function readBool(values: Settings, key: string, fallback = false) {
  const value = values[key];
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

/** The saved brand choice, normalised into what `buildTheme` expects. */
export function themeChoice(values: Settings): ThemeChoice {
  return {
    id: values.theme_id ?? "factory",
    count: values.theme_count === "2" ? 2 : 3,
    primary: values.theme_primary ?? FACTORY.p,
    secondary: values.theme_secondary ?? FACTORY.s,
    tertiary: values.theme_tertiary ?? FACTORY.t,
  };
}
