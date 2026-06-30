"use client";

import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type GenericConfirmDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  itemName: string;
  warning: string;
  confirmLabel?: string;
  loading?: boolean;
  danger?: boolean;
};

export function GenericConfirmDialog({ open, onConfirm, onCancel, title, itemName, warning, confirmLabel, loading, danger = true }: GenericConfirmDialogProps) {
  if (!open) return null;

  const gradient = danger ? "from-red-600 to-orange-600" : "from-amber-600 to-yellow-600";
  const borderColor = danger ? "border-red-100 bg-red-50" : "border-amber-100 bg-amber-50";
  const textColor = danger ? "text-red-800" : "text-amber-800";
  const labelColor = danger ? "text-red-900" : "text-amber-900";
  const helpColor = danger ? "text-red-600" : "text-amber-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="relative mx-auto w-full max-w-sm animate-[reveal-up_0.5s_cubic-bezier(0.2,0,0,1)_both] rounded-2xl border border-border bg-gradient-to-b from-background to-accent/5 p-0 shadow-2xl"
        role="dialog"
        aria-label={title.toLowerCase()}
      >
        <div className={`relative overflow-hidden rounded-t-2xl bg-gradient-to-r ${gradient} px-6 py-8 text-center text-white`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <AlertTriangle className="size-8" />
          </div>
          <h2 className="relative mt-4 text-xl font-black tracking-tight">{title}</h2>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className={`animate-[reveal-up_0.4s_cubic-bezier(0.2,0,0,1)_both_0.15s] rounded-xl border ${borderColor} p-4 text-center`}>
            <p className={`text-sm font-bold ${textColor}`}>
              You are about to {danger ? "delete" : "modify"}
            </p>
            <p className={`mt-1 text-lg font-black ${labelColor}`}>
              &ldquo;{itemName}&rdquo;
            </p>
            <p className={`mt-3 text-xs ${helpColor}`}>
              {warning}
            </p>
          </div>

          <div className="animate-[reveal-up_0.4s_cubic-bezier(0.2,0,0,1)_both_0.25s] flex gap-3">
            <Button
              className="flex-1 gap-2 py-3"
              disabled={loading}
              onClick={onCancel}
              size="lg"
              type="button"
              variant="secondary"
            >
              <X className="size-4" /> Cancel
            </Button>
            <Button
              className="flex-1 gap-2 py-3"
              disabled={loading}
              onClick={onConfirm}
              size="lg"
              type="button"
              variant="primary"
            >
              {loading ? "Processing..." : <>{confirmLabel ?? (danger ? "Delete" : "Confirm")} <ArrowRight className="size-4" /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
