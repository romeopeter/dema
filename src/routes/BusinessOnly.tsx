import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useIsBusiness, useProfileStore } from "@/store/profileStore";

/**
 * Invoices and clients only exist under a business profile. The nav already hides those
 * destinations, but switching profiles while sitting on one of these screens would
 * otherwise leave you looking at another book's invoices.
 */
export function BusinessOnly({ children }: { children: ReactNode }) {
  const loaded = useProfileStore((s) => s.loaded);
  const isBusiness = useIsBusiness();

  if (!loaded) return null;
  if (!isBusiness) return <Navigate to="/" replace />;
  return <>{children}</>;
}
