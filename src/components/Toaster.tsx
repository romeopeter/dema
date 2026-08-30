import { AlertIcon, CheckIcon, CloseIcon } from "@/components/icons";
import { useUiStore } from "@/store/uiStore";

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-8 bottom-8 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex max-w-[420px] items-start gap-3 rounded-[20px] border-[1.5px] px-5 py-4 shadow-panel ${
            toast.tone === "success"
              ? "border-bp bg-surface"
              : "border-alert bg-alert-bg"
          }`}
        >
          <span
            className={`mt-[2px] flex-none ${
              toast.tone === "success" ? "text-success" : "text-alert"
            }`}
          >
            {toast.tone === "success" ? (
              <CheckIcon size={18} />
            ) : (
              <AlertIcon size={18} />
            )}
          </span>
          <span className="flex-1 text-[14px] leading-5 text-ink">
            {toast.message}
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(toast.id)}
            className="mt-[2px] flex-none text-faint hover:text-ink"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
