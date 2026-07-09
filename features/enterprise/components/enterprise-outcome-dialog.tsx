"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export type OutcomeDetail = {
  label: string;
  value: string;
};

export type EnterpriseOutcome = {
  status: "success" | "error";
  title: string;
  itemName: string;
  message: string;
  details?: OutcomeDetail[];
};

type EnterpriseOutcomeDialogProps = {
  open: boolean;
  outcome: EnterpriseOutcome | null;
  onClose: () => void;
  actionLabel?: string;
};

const config = {
  success: {
    gradient: "from-emerald-600 via-teal-600 to-cyan-600",
    accent: "bg-emerald-50 border-emerald-100 text-emerald-800",
    button: "primary",
    icon: CheckCircle2
  },
  error: {
    gradient: "from-red-600 via-rose-600 to-orange-600",
    accent: "bg-red-50 border-red-100 text-red-800",
    button: "primary",
    icon: AlertTriangle
  }
} as const;

export function EnterpriseOutcomeDialog({ open, outcome, onClose, actionLabel = "Done" }: EnterpriseOutcomeDialogProps) {
  if (!open || !outcome) return null;

  const theme = config[outcome.status];
  const Icon = outcome.status === "success" ? Sparkles : theme.icon;
  const detailRows = outcome.details ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-md">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-background to-surface shadow-[0_30px_120px_rgba(0,0,0,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-label={outcome.title}
      >
        <div className={`relative overflow-hidden bg-gradient-to-r ${theme.gradient} px-6 py-8 text-white`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.22),transparent_55%)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <Icon className="size-7" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-white/75">
                  {outcome.status === "success" ? "Gym saved" : "Gym save failed"}
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">{outcome.title}</h2>
              </div>
            </div>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white/90">
              {outcome.status}
            </span>
          </div>
          <p className="relative mt-4 max-w-[90%] text-sm leading-6 text-white/85">{outcome.message}</p>
        </div>

        <div className="space-y-5 p-6">
          <div className={`rounded-2xl border px-4 py-4 ${theme.accent}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-current/70">Gym</p>
            <p className="mt-1 text-xl font-black">{outcome.itemName}</p>
          </div>

          {detailRows.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border">
              {detailRows.map((detail, index) => (
                <div className={`flex items-center gap-4 px-4 py-3 text-sm ${index === 0 ? "" : "border-t border-border"}`} key={`${detail.label}-${detail.value}`}>
                  <span className="text-muted-foreground">{detail.label}</span>
                  <span className="ml-auto font-semibold text-right text-foreground">{detail.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          {outcome.status === "error" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-800">Required before retry</p>
              <p className="mt-1 text-sm leading-6 text-red-700">
                Check the gym name, timezone, currency, and organization selection before submitting again.
              </p>
            </div>
          ) : null}

          <Button className="w-full gap-2 py-6 text-base" onClick={onClose} type="button" variant={theme.button}>
            {actionLabel}
            <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
