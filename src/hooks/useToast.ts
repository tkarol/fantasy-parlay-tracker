import { useContext } from "react";
import { ToastContext, type ToastState } from "../providers/toastContext";

export function useToast(): ToastState {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
