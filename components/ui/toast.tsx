"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

let addToastFn: ((message: string, variant: ToastVariant) => void) | null = null;

export function showToast(message: string, variant: ToastVariant = "info") {
  addToastFn?.(message, variant);
}

const toastVariants: Record<ToastVariant, { icon: React.ElementType; className: string }> = {
  success: { icon: CheckCircle2, className: "border-emerald-500/30 bg-emerald-50 text-emerald-900" },
  error: { icon: XCircle, className: "border-red-500/30 bg-red-50 text-red-900" },
  info: { icon: Info, className: "border-blue-500/30 bg-blue-50 text-blue-900" },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const shouldReduceMotion = useReducedMotion();

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, variant: ToastVariant) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const config = toastVariants[toast.variant];
          const Icon = config.icon;
          return (
            <motion.div
              key={toast.id}
              layout={shouldReduceMotion ? false : true}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 350, damping: 28, mass: 0.8 }}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-bold shadow-lg",
                config.className
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity"
                type="button"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
