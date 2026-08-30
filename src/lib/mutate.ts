import { errorMessage } from "@/lib/tauri";
import { announce, refreshData } from "@/store/uiStore";

/**
 * Runs a mutation, then refreshes every view that reads data.
 *
 * The refresh is not a nicety: the dashboard figures and the donut have to reflect the
 * latest posted state the moment a transaction is added or an invoice is paid, and this
 * is the single place that guarantees it. Errors surface as a toast and resolve to null,
 * so call sites branch on the result rather than wrapping each call in try/catch.
 */
export async function mutate<T>(
  action: () => Promise<T>,
  options: { success?: string; onError?: (message: string) => void } = {},
): Promise<T | null> {
  try {
    const result = await action();
    refreshData();
    if (options.success) announce("success", options.success);
    return result;
  } catch (error) {
    const message = errorMessage(error);
    if (options.onError) options.onError(message);
    else announce("error", message);
    return null;
  }
}
