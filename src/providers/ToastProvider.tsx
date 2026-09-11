import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastContext, type Toast, type ToastInput, type ToastState } from "./toastContext";

const DEFAULT_DURATION = 4500;

/**
 * Replaces the `alert()` calls the original build used for every success,
 * failure and validation message.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const toast: Toast = { ...input, id };
      setToasts((current) => [...current.slice(-3), toast]);

      // Errors stay until dismissed — they usually need reading, not glancing.
      const duration = input.duration ?? (input.tone === "error" ? 0 : DEFAULT_DURATION);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastState>(
    () => ({
      toasts,
      show,
      dismiss,
      success: (title, description) => show({ tone: "success", title, description }),
      error: (title, description) => show({ tone: "error", title, description }),
      info: (title, description) => show({ tone: "info", title, description }),
      warning: (title, description) => show({ tone: "warning", title, description }),
    }),
    [toasts, show, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const TONE_STYLES: Record<Toast["tone"], { wrap: string; icon: string; glyph: string }> = {
  success: {
    wrap: "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/60",
    icon: "text-emerald-600 dark:text-emerald-400",
    glyph: "✓",
  },
  error: {
    wrap: "border-rose-500/30 bg-rose-50 dark:bg-rose-950/60",
    icon: "text-rose-600 dark:text-rose-400",
    glyph: "!",
  },
  warning: {
    wrap: "border-amber-500/30 bg-amber-50 dark:bg-amber-950/60",
    icon: "text-amber-600 dark:text-amber-400",
    glyph: "!",
  },
  info: {
    wrap: "border-line bg-surface",
    icon: "text-ink-muted",
    glyph: "i",
  },
};

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      // `pointer-events-none` on the stack keeps it from blocking the page;
      // each toast re-enables them for itself.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const tone = TONE_STYLES[toast.tone];
        return (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto w-full max-w-sm animate-toast-in rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${tone.wrap}`}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-content-center rounded-full border border-current text-[11px] font-bold ${tone.icon}`}
              >
                {tone.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 break-words text-xs text-ink-muted">{toast.description}</p>
                )}
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      onDismiss(toast.id);
                    }}
                    className="mt-2 text-xs font-semibold text-ink underline underline-offset-2"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-1 rounded-md p-1 text-ink-faint transition hover:text-ink"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
