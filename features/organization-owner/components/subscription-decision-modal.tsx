"use client";

import { AlertTriangle, ArrowRight, Calendar, Clock, CreditCard, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SubscriptionDecisionModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (mode: "now" | "later") => void;
  loading?: boolean;
  currentPlanName: string;
  currentExpiryDate: string;
  remainingDays: number;
  newPlanName: string;
};

export function SubscriptionDecisionModal({
  open,
  onClose,
  onConfirm,
  loading,
  currentPlanName,
  currentExpiryDate,
  remainingDays,
  newPlanName,
}: SubscriptionDecisionModalProps) {
  if (!open) return null;

  const expiryDate = new Date(currentExpiryDate);
  const formattedExpiry = expiryDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const newStartLater = new Date(expiryDate);
  newStartLater.setDate(newStartLater.getDate() + 1);
  const formattedStartLater = newStartLater.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2">
              <AlertTriangle className="size-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-black">Start New Plan</h3>
              <p className="text-xs text-muted-foreground">Your current plan is cancelled but still active</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="rounded-lg border border-border bg-background p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Plan</span>
              <span className="font-bold">{currentPlanName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Expires On</span>
              <span className="font-semibold">{formattedExpiry}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                <Clock className="size-3" /> {remainingDays} day{remainingDays !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-border pt-2 mt-2">
              <span className="text-muted-foreground">New Plan</span>
              <span className="font-bold text-primary">{newPlanName}</span>
            </div>
          </div>

          <p className="text-sm font-semibold">When would you like the new plan to start?</p>

          <div className="grid gap-3">
            <button
              onClick={() => onConfirm("now")}
              disabled={loading}
              className={cn(
                "group flex items-start gap-4 rounded-lg border-2 bg-background p-4 text-left transition-all hover:border-primary hover:shadow-md",
                loading ? "opacity-50 cursor-not-allowed" : "border-primary/30"
              )}
              type="button"
            >
              <div className="mt-0.5 rounded-full border-2 border-primary p-1 group-hover:bg-primary/10">
                <ArrowRight className="size-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Start New Plan Immediately</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ignore remaining {remainingDays} day{remainingDays !== 1 ? "s" : ""} of your current plan and start <strong>{newPlanName}</strong> from today.
                </p>
                <div className="mt-2 flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
                  <AlertTriangle className="size-3" />
                  You will lose {remainingDays} day{remainingDays !== 1 ? "s" : ""} of your current {currentPlanName} plan.
                </div>
              </div>
            </button>

            <button
              onClick={() => onConfirm("later")}
              disabled={loading}
              className={cn(
                "group flex items-start gap-4 rounded-lg border-2 bg-background p-4 text-left transition-all hover:border-primary hover:shadow-md",
                loading ? "opacity-50 cursor-not-allowed" : "border-primary/30"
              )}
              type="button"
            >
              <div className="mt-0.5 rounded-full border-2 border-primary p-1 group-hover:bg-primary/10">
                <Calendar className="size-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Start After Current Plan Expires</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Keep your current {currentPlanName} until {formattedExpiry}. {newPlanName} will activate on <strong>{formattedStartLater}</strong>.
                </p>
                <div className="mt-2 flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-[11px] text-green-700">
                  <Shield className="size-3" />
                  You keep full access until expiry. New plan auto-activates after.
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={loading} type="button">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
