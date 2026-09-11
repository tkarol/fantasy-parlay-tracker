import { createContext } from "react";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Milliseconds on screen. Errors persist until dismissed by default. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export type ToastInput = Omit<Toast, "id">;

export interface ToastState {
  toasts: Toast[];
  show: (toast: ToastInput) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastState | null>(null);
