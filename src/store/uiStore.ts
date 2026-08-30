import { create } from "zustand";

export interface Toast {
  id: number;
  tone: "success" | "error";
  message: string;
}

interface UiState {
  navCollapsed: boolean;
  notifOpen: boolean;
  /**
   * Bumped after every successful mutation. Fetch hooks list it as a dependency, so a
   * new transaction or a paid invoice refreshes the dashboard totals and the donut
   * without any screen having to know which other screens care.
   */
  revision: number;
  toasts: Toast[];

  toggleNav: () => void;
  setNotifOpen: (open: boolean) => void;
  refresh: () => void;
  toast: (tone: Toast["tone"], message: string) => void;
  dismissToast: (id: number) => void;
}

let nextToastId = 1;

export const useUiStore = create<UiState>((set) => ({
  navCollapsed: false,
  notifOpen: false,
  revision: 0,
  toasts: [],

  toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
  setNotifOpen: (notifOpen) => set({ notifOpen }),
  refresh: () => set((s) => ({ revision: s.revision + 1 })),

  toast: (tone, message) => {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts, { id, tone, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Shorthand for the common "mutation succeeded" pair. */
export function announce(tone: Toast["tone"], message: string) {
  useUiStore.getState().toast(tone, message);
}

export function refreshData() {
  useUiStore.getState().refresh();
}
