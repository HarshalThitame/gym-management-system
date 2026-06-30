"use client";

import { Check, ArrowRight, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type GenericAction = "created" | "updated" | "deleted";

export type SuccessDetail = {
  label: string;
  value: string;
};

type GenericSuccessDialogProps = {
  open: boolean;
  onClose: () => void;
  action: GenericAction;
  title: string;
  itemName: string;
  badge?: { label: string; color: string };
  details?: SuccessDetail[];
};

const actionConfig: Record<GenericAction, {
  gradient: string;
  icon: typeof Check;
  badgeBg: string;
  textColor: string;
}> = {
  created: {
    gradient: "from-violet-600 to-indigo-600",
    icon: Check,
    badgeBg: "bg-violet-50 border-violet-100",
    textColor: "text-violet-800",
  },
  updated: {
    gradient: "from-blue-600 to-cyan-600",
    icon: Sparkles,
    badgeBg: "bg-blue-50 border-blue-100",
    textColor: "text-blue-800",
  },
  deleted: {
    gradient: "from-red-600 to-orange-600",
    icon: Trash2,
    badgeBg: "bg-red-50 border-red-100",
    textColor: "text-red-800",
  },
};

export function GenericSuccessDialog({ open, onClose, action, title, itemName, badge, details }: GenericSuccessDialogProps) {
  if (!open) return null;

  const cfg = actionConfig[action];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="relative mx-auto w-full max-w-md animate-[reveal-up_0.5s_cubic-bezier(0.2,0,0,1)_both] rounded-2xl border border-border bg-gradient-to-b from-background to-accent/5 p-0 shadow-2xl"
        role="dialog"
        aria-label={title.toLowerCase()}
      >
        <div className={`relative overflow-hidden rounded-t-2xl bg-gradient-to-r ${cfg.gradient} px-6 py-10 text-center text-white`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <cfg.icon className="size-8" />
          </div>
          <h2 className="relative mt-4 text-2xl font-black tracking-tight">{title}</h2>
          <p className="relative mt-1 text-sm text-white/80">{itemName}</p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className={`animate-[reveal-up_0.4s_cubic-bezier(0.2,0,0,1)_both_0.15s] rounded-xl border ${cfg.badgeBg} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{action === "deleted" ? "Deleted" : "Item"}</p>
                <p className={`text-lg font-black ${cfg.textColor}`}>{itemName}</p>
              </div>
              {badge && (
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.color}`}>
                  {badge.label}
                </span>
              )}
            </div>
          </div>

          {details && details.length > 0 && (
            <div className="animate-[reveal-up_0.4s_cubic-bezier(0.2,0,0,1)_both_0.25s] space-y-0 divide-y divide-border rounded-xl border border-border">
              {details.map((item) => (
                <div key={item.label} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="ml-auto font-semibold text-right">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          <Button variant="primary" size="lg" className="w-full gap-2 py-6 text-base" onClick={onClose} type="button">
            Got it
            <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
