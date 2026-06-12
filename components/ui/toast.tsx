"use client";

import { useCallback, useEffect, useState } from "react";
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

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  const addToast = useCallback((message: string, variant: ToastVariant) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setRemoving((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        setRemoving((prev) => { const next = new Set(prev); next.delete(id); return next; });
      }, 300);
    }, 4000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-bold shadow-lg transition-all duration-300",
            removing.has(toast.id) ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100",
            toast.variant === "success" && "border-emerald-500/30 bg-emerald-50 text-emerald-900",
            toast.variant === "error" && "border-red-500/30 bg-red-50 text-red-900",
            toast.variant === "info" && "border-blue-500/30 bg-blue-50 text-blue-900"
          )}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
