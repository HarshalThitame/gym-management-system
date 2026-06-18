"use client";

import { Check, ArrowRight, Shield, FileText, CreditCard, Calendar, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaymentSuccessDetails = {
  paymentId: string;
  orderId: string;
  invoiceId: string;
  subscriptionId: string | null;
  amountPaise: number;
  currency: string;
  packageName: string;
  billingCycle: string;
  timestamp: string;
  isTestMode: boolean;
};

type PaymentSuccessDialogProps = {
  open: boolean;
  details: PaymentSuccessDetails | null;
  onClose: () => void;
};

function formatPaise(paise: number): string {
  return `₹${Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100)}`;
}

export function PaymentSuccessDialog({ open, details, onClose }: PaymentSuccessDialogProps) {
  if (!open || !details) return null;

  const detailItems = [
    { icon: CreditCard, label: "Payment ID", value: details.paymentId },
    { icon: Hash, label: "Order ID", value: details.orderId },
    { icon: FileText, label: "Invoice ID", value: details.invoiceId },
    ...(details.subscriptionId
      ? [{ icon: Shield, label: "Subscription ID", value: details.subscriptionId }]
      : [] as { icon: typeof Shield; label: string; value: string }[]),
    { icon: Calendar, label: "Date & Time", value: new Date(details.timestamp).toLocaleString("en-IN") },
    { icon: CreditCard, label: "Amount Paid", value: formatPaise(details.amountPaise) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-auto w-full max-w-lg rounded-2xl border border-border bg-gradient-to-b from-background to-accent/5 p-0 shadow-2xl">
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-8 text-center text-white">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/20">
            <Check className="size-8" />
          </div>
          <h2 className="mt-4 text-2xl font-black">Payment Successful!</h2>
          <p className="mt-1 text-sm text-white/80">Your subscription has been activated</p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Plan</p>
                <p className="text-lg font-black text-emerald-800">{details.packageName}</p>
              </div>
              <div className="rounded-full bg-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
                {details.billingCycle === "annual" ? "Annual" : "Monthly"}
              </div>
            </div>
          </div>

          <div className="space-y-0 divide-y divide-border rounded-xl border border-border">
            {detailItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3 text-sm">
                <item.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{item.label}</span>
                <span className="ml-auto font-semibold font-mono text-xs break-all text-right max-w-[200px]">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {details.isTestMode && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="flex items-start gap-2">
                <Shield className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Test Mode Payment</p>
                  <p>This was a test transaction. No real money was charged.</p>
                </div>
              </div>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full gap-2 py-6 text-base"
            onClick={onClose}
            type="button"
          >
            Go to Plans
            <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
