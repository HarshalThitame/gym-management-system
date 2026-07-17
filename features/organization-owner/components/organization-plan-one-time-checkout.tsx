"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { useRazorpayScript } from "@/features/billing/razorpay/use-razorpay-script";
import {
  createOrgPlanOneTimeCheckoutIntentAction,
  finalizeOrgPlanOneTimePaymentIntentAction,
} from "@/features/organization-owner/actions/plan-one-time-actions";
import { formatCurrency } from "@/features/billing/lib/money";

type PackageInfo = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  _pricing?: Array<{ billing_period: string; price: number }>;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => { open(): void };
type RazorpayWindow = Window & typeof globalThis & { Razorpay?: RazorpayConstructor };

type OrganizationPlanOneTimeCheckoutProps = {
  organizationName: string;
  customerEmail: string;
  customerContact?: string;
  allPackages: PackageInfo[];
  currentSubscriptionStatus?: string | null;
  initialSelectedPackageId?: string | null;
  initialBillingCycle?: "monthly" | "annual";
};

type CheckoutResponse = {
  razorpayKeyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  subtotalPaise: number;
  taxPaise: number;
  currency: string;
  invoiceId: string;
  paymentRecordId: string;
  subscriptionId: string;
  packageDisplayName: string;
  organizationDisplayName: string;
  billingCycle: string;
  isTestMode: boolean;
  environmentLabel: string;
};

type PaymentResult = {
  invoiceId: string;
  paymentRecordId: string;
  subscriptionId: string;
};

export function OrganizationPlanOneTimeCheckout({
  organizationName,
  customerEmail,
  customerContact,
  allPackages,
  currentSubscriptionStatus,
  initialSelectedPackageId,
  initialBillingCycle,
}: OrganizationPlanOneTimeCheckoutProps) {
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(initialSelectedPackageId ?? null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(initialBillingCycle ?? "monthly");
  const [status, setStatus] = useState<"idle" | "preparing" | "opened" | "verifying" | "finalizing" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutResponse | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [lastSuccess, setLastSuccess] = useState<{ paymentRecordId: string; invoiceId: string; subscriptionId: string; timestamp: string } | null>(null);
  const scriptStatus = useRazorpayScript(true);

  useEffect(() => {
    if (initialSelectedPackageId) {
      setSelectedPkgId(initialSelectedPackageId);
    }
  }, [initialSelectedPackageId]);

  useEffect(() => {
    if (initialBillingCycle) {
      setBillingCycle(initialBillingCycle);
    }
  }, [initialBillingCycle]);

  const activePackages = useMemo(() => allPackages.filter((pkg) => pkg.is_active), [allPackages]);
  const selectedPkg = useMemo(() => {
    if (!selectedPkgId) return activePackages[0] ?? null;
    return activePackages.find((pkg) => pkg.id === selectedPkgId) ?? activePackages[0] ?? null;
  }, [activePackages, selectedPkgId]);

  const selectedPrice = useMemo(() => {
    if (!selectedPkg) return 0;
    const pricing = selectedPkg._pricing ?? [];
    return pricing.find((p) => p.billing_period === billingCycle)?.price ?? 0;
  }, [billingCycle, selectedPkg]);

  const createCheckout = useCallback(async () => {
    if (!selectedPkg) {
      setStatus("error");
      setMessage("Select a plan before continuing.");
      return null;
    }

    const response = await createOrgPlanOneTimeCheckoutIntentAction({
      targetPackageId: selectedPkg.id,
      billingCycle,
    });

    if (!response.success) {
      setStatus("error");
      setMessage(response.error);
      showToast(response.error, "error");
      return null;
    }

    return response;
  }, [billingCycle, selectedPkg]);

  const openCheckout = useCallback(async () => {
    setMessage(null);
    setStatus("preparing");

    if (scriptStatus !== "loaded" || !(window as RazorpayWindow).Razorpay) {
      setStatus("error");
      setMessage("Razorpay checkout.js could not be loaded.");
      return;
    }

    const result = await createCheckout();
    if (!result) return;

    const Razorpay = (window as RazorpayWindow).Razorpay;
    if (!Razorpay) {
      setStatus("error");
      setMessage("Razorpay checkout.js could not be loaded.");
      return;
    }

    setCheckoutData(result);
    setStatus("opened");

    const checkout = new Razorpay({
      key: result.razorpayKeyId,
      amount: result.amountPaise,
      currency: result.currency,
      name: organizationName || "Gym Management",
      description: `${result.packageDisplayName} — ${result.billingCycle === "annual" ? "Annual one-time invoice" : "Monthly one-time invoice"}`,
      order_id: result.razorpayOrderId,
      prefill: {
        name: organizationName,
        email: customerEmail,
        contact: customerContact || undefined,
      },
      theme: { color: "#2563eb" },
      modal: {
        confirm_close: true,
        ondismiss: () => {
          setStatus("idle");
          setMessage("Payment cancelled.");
          showToast("Payment cancelled.", "info");
        },
      },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        setStatus("verifying");
        const verifyResponse = await fetch("/api/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });

        const verifyPayload = await verifyResponse.json() as { ok: boolean; error?: { message?: string } };
        if (!verifyPayload.ok) {
          const errorMessage = verifyPayload.error?.message ?? "Payment verification failed.";
          setStatus("error");
          setMessage(errorMessage);
          showToast(errorMessage, "error");
          return;
        }

        setStatus("finalizing");
        const finalizeResult = await finalizeOrgPlanOneTimePaymentIntentAction({
          invoiceId: result.invoiceId,
          paymentRecordId: result.paymentRecordId,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
          razorpaySignature: response.razorpay_signature,
        });

        if (!finalizeResult.success) {
          setStatus("error");
          setMessage(finalizeResult.error);
          showToast(finalizeResult.error, "error");
          return;
        }

        const finalPayment = {
          paymentRecordId: finalizeResult.paymentRecordId,
          invoiceId: finalizeResult.invoiceId,
          subscriptionId: finalizeResult.subscriptionId,
          timestamp: new Date().toISOString(),
        };
        setPaymentResult(finalPayment);
        setLastSuccess(finalPayment);
        setStatus("success");
        setMessage("One-time payment completed and plan updated.");
        showToast("One-time payment completed.", "success");
      },
    });

    checkout.on("payment.failed", (response: { error?: { description?: string; reason?: string } }) => {
      const errorMessage = response.error?.description ?? response.error?.reason ?? "Payment failed.";
      setStatus("error");
      setMessage(errorMessage);
      showToast(errorMessage, "error");
    });

    checkout.open();
  }, [createCheckout, customerContact, customerEmail, organizationName, scriptStatus]);

  return (
    <div className="space-y-6">
      <ToastContainer />

      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">One-time billing</p>
              <h3 className="mt-1 text-2xl font-black">Pay once for your org plan</h3>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                This flow uses Razorpay Standard Checkout and creates an invoice-based plan renewal.
                Auto-debit is not used for this purchase.
              </p>
            </div>
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
              Invoice renewal
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Selected package</p>
                  <p className="mt-1 text-xl font-black">{selectedPkg?.name ?? "Choose a plan"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedPkg?.description ?? "Use Compare Plans to pick a target package."}</p>
                </div>
                {currentSubscriptionStatus ? (
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                    Current: {currentSubscriptionStatus}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="rounded-lg border border-border bg-background p-3">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Monthly</span>
                  <input
                    checked={billingCycle === "monthly"}
                    className="mt-2"
                    name="billingCycle"
                    onChange={() => setBillingCycle("monthly")}
                    type="radio"
                  />
                  <span className="ml-2 text-sm font-semibold">Monthly invoice</span>
                </label>
                <label className="rounded-lg border border-border bg-background p-3">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Annual</span>
                  <input
                    checked={billingCycle === "annual"}
                    className="mt-2"
                    name="billingCycle"
                    onChange={() => setBillingCycle("annual")}
                    type="radio"
                  />
                  <span className="ml-2 text-sm font-semibold">Annual invoice</span>
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {activePackages.slice(0, 3).map((pkg) => {
                  const price = (pkg._pricing ?? []).find((p) => p.billing_period === billingCycle)?.price ?? 0;
                  return (
                    <button
                      key={pkg.id}
                      className={`rounded-lg border px-3 py-3 text-left transition ${
                        selectedPkg?.id === pkg.id ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-accent/5"
                      }`}
                      onClick={() => setSelectedPkgId(pkg.id)}
                      type="button"
                    >
                      <p className="text-sm font-bold">{pkg.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(price, "INR")}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Preview</p>
              <p className="mt-2 text-3xl font-black">{formatCurrency(selectedPrice, "INR")}</p>
              <p className="mt-1 text-xs text-muted-foreground">Base package price before tax</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Billing type</span>
                  <span className="font-semibold">One-time invoice</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Auto-debit</span>
                  <span className="font-semibold text-emerald-600">Disabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-semibold">{customerEmail || "No billing email"}</span>
                </div>
              </div>
            </div>
          </div>

          {currentSubscriptionStatus === "active" || currentSubscriptionStatus === "trial" ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-bold">This payment will convert your plan to invoice-based billing.</p>
              <p className="mt-1 text-xs text-blue-800">
                The current subscription can remain active until the new one-time invoice is confirmed.
                After success, the plan stays active without creating a Razorpay subscription.
              </p>
            </div>
          ) : null}

          {status === "error" && message ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{message}</p>
              </div>
            </div>
          ) : null}

          {status === "success" && lastSuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-bold">Payment completed</p>
                  <p className="mt-1 text-xs">
                    Payment record {lastSuccess.paymentRecordId} captured for invoice {lastSuccess.invoiceId}.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="gap-2"
              disabled={status === "preparing" || status === "verifying" || status === "finalizing"}
              onClick={openCheckout}
              type="button"
              variant="accent"
            >
              {status === "preparing" || status === "verifying" || status === "finalizing" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              {status === "preparing"
                ? "Preparing invoice"
                : status === "verifying"
                  ? "Verifying payment"
                  : status === "finalizing"
                    ? "Finalizing plan"
                    : "Pay once with Razorpay"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {checkoutData
                ? `${checkoutData.environmentLabel} · ${checkoutData.isTestMode ? "Test mode" : "Live mode"}`
                : "No subscription will be created for this payment."}
            </span>
          </div>

          {paymentResult ? (
            <div className="rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
              <p className="font-bold text-foreground">Payment snapshot</p>
              <p className="mt-1 break-all">Subscription {paymentResult.subscriptionId}</p>
              <p className="break-all">Invoice {paymentResult.invoiceId}</p>
              <p className="break-all">Payment record {paymentResult.paymentRecordId}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
