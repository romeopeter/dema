import { useEffect, useState } from "react";
import { RouterProvider } from "react-router-dom";

import { ErrorNote } from "@/components/ui/empty-state";
import { errorMessage } from "@/lib/tauri";
import { router } from "@/routes/router";
import { useProfileStore } from "@/store/profileStore";
import { useSettingsStore } from "@/store/settingsStore";

export function App() {
  const loadProfiles = useProfileStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Settings first: the saved active profile and brand theme both live there, and
  // loading them in this order avoids a flash of the factory palette.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSettings();
        await loadProfiles();
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfiles, loadSettings]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="w-[520px]">
          <ErrorNote
            message={`Dema could not open your ledger. ${error}`}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-[15px] text-muted">
        Opening your ledger…
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
