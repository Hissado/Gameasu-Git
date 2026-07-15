/**
 * Shim de compatibilité — délègue toutes les notifications à sonner.
 * Les pages qui importent `useToast` / `toast` depuis ce module continuent
 * de fonctionner sans modification ; les messages passent par sonner.
 */
import { toast as sonner } from "sonner";

type ToastOptions = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
};

function toast(opts: ToastOptions) {
  const message = opts.title ?? "";
  const description = opts.description;
  if (opts.variant === "destructive") {
    sonner.error(message, description ? { description } : undefined);
  } else {
    sonner.success(message, description ? { description } : undefined);
  }
}

toast.error = (message: string, opts?: { description?: string }) =>
  sonner.error(message, opts);
toast.success = (message: string, opts?: { description?: string }) =>
  sonner.success(message, opts);
toast.warning = (message: string, opts?: { description?: string }) =>
  sonner.warning(message, opts);
toast.info = (message: string, opts?: { description?: string }) =>
  sonner.info(message, opts);
toast.dismiss = (id?: string | number) => sonner.dismiss(id);

function useToast() {
  return { toast, dismiss: sonner.dismiss };
}

export { useToast, toast };
