"use client";

import { CreditCard, Loader2, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SecureCheckoutIntentResult } from "@/features/billing/razorpay/razorpay-types";

type OrderSummaryDialogProps = {
  open: boolean;
  onClose: () => void;
  checkoutData: SecureCheckoutIntentResult & { success: true };
  onProceedToPay: () => void;
  processing: boolean;
};

function formatPaise(paise: number): string {
  return `₹${Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100)}`;
}

export function OrderSummaryDialog({
  open,
  onClose,
  checkoutData,
  onProceedToPay,
  processing,
}: OrderSummaryDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-auto w-full max-w-lg rounded-2xl border border-border bg-gradient-to-b from-background to-accent/5 p-0 shadow-2xl">
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white">
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 text-white/70 transition hover:bg-white/20 hover:text-white" type="button">
            <X className="size-5" />
          </button>
          <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
            <Shield className="size-4" />
            <span>Secured by Razorpay</span>
          </div>
          <h2 className="mt-3 text-2xl font-black">Subscription Summary</h2>
          <p className="mt-1 text-sm text-white/80">Review your auto-debit details before authorization</p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-xl border border-border bg-accent/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Plan</p>
                <p className="text-lg font-black">{checkoutData.packageDisplayName}</p>
              </div>
              <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                {checkoutData.billingCycle === "annual" ? "Annual auto-debit" : "Monthly auto-debit"}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-accent/5 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatPaise(checkoutData.subtotalPaise)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-semibold">{formatPaise(checkoutData.taxPaise)}</span>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-black">Total</span>
                <span className="text-xl font-black text-indigo-600">{formatPaise(checkoutData.amountPaise)}</span>
              </div>
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {checkoutData.isTestMode ? "Test mode — no real charges" : "Mandate-based auto-debit will be charged by Razorpay"}
              </p>
            </div>
          </div>

            {checkoutData.isTestMode && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="flex items-start gap-2">
                <Shield className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Test Mode</p>
                  <p>This is a test authorization. No real money will be charged.</p>
                </div>
              </div>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full gap-2 py-6 text-base"
            onClick={onProceedToPay}
            disabled={processing}
            type="button"
          >
            {processing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CreditCard className="size-5" />
            )}
            {processing ? "Preparing Authorization..." : `Authorize ${formatPaise(checkoutData.amountPaise)} via Razorpay`}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Your authorization is processed securely by Razorpay. We do not store card details.
          </p>
        </div>
      </div>
    </div>
  );
}
