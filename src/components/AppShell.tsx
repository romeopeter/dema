import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "@/components/Toaster";
import { useDashboard } from "@/features/transactions/hooks";
import { applyTheme, resolveTheme } from "@/lib/theme";
import { themeChoice, useSettingsStore } from "@/store/settingsStore";
import { useActiveProfile, useProfileStore } from "@/store/profileStore";
import { useUiStore } from "@/store/uiStore";

/**
 * Below roughly 1100px the rail collapses on its own, per the responsive notes: the
 * content column is what should keep its width, not the nav.
 */
function useNarrowWindow(breakpoint = 1100) {
  const [narrow, setNarrow] = useState(
    () => window.innerWidth < breakpoint,
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return narrow;
}

export function AppShell() {
  const location = useLocation();
  const profiles = useProfileStore((s) => s.profiles);
  const loaded = useProfileStore((s) => s.loaded);
  const activeProfile = useActiveProfile();
  const settings = useSettingsStore((s) => s.values);

  const navCollapsed = useUiStore((s) => s.navCollapsed);
  const toggleNav = useUiStore((s) => s.toggleNav);
  const setNotifOpen = useUiStore((s) => s.setNotifOpen);
  const narrow = useNarrowWindow();
  const collapsed = navCollapsed || narrow;

  // The brand theme is scoped to the business book. On personal this always resolves to
  // the factory palette, which is the theme-leak the handoff left open.
  useEffect(() => {
    applyTheme(resolveTheme(themeChoice(settings), activeProfile?.type ?? null));
  }, [settings, activeProfile?.type]);

  // A stray open panel should not survive a screen change.
  useEffect(() => {
    setNotifOpen(false);
  }, [location.pathname, setNotifOpen]);

  const dashboard = useDashboard("all");

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-[15px] text-muted">
        Opening your ledger…
      </div>
    );
  }

  if (profiles.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="flex h-full overflow-hidden bg-canvas text-ink">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleNav}
        draftCount={dashboard.data?.draftCount ?? 0}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
