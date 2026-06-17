"use client";

import { useState, useCallback } from "react";
import { CreditCard, Loader2, Check, AlertTriangle, Shield, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { useRazorpayScript } from "@/features/billing/razorpay/use-razorpay-script";
import { createSecureSubscriptionCheckoutOrderAction } from "@/features/billing/services/subscription-payment-orchestrator";
import { acknowledgeRazorpayCheckoutResultAction, getSubscriptionPaymentStatusAction } from "@/features/billing/services/payment-acknowledgement";
import type { CheckoutOrderState } from "@/features/billing/razorpay/razorpay-checkout-types";

type PackageInfo = {
  id: string;
  name: string;
  slug?: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  _pricing?: Array<{ billing_period: string; price: number }>;
  _limits?: Record<string, unknown>;
  price: number;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => { open(): void };
type RazorpayWindow = Window & typeof globalThis & { Razorpay?: RazorpayConstructor };

type RazorpayCheckoutProps = {
  organizationId: string;
  organizationName: string;
  customerEmail: string;
  customerContact?: string;
  allPackages: PackageInfo[];
  currentPackageId?: string | null;
  currentSubscriptionId?: string | null;
};

export function RazorpayCheckout({
  organizationName,
  customerEmail,
  customerContact,
  allPackages,
  currentPackageId,
}: RazorpayCheckoutProps) {
  const scriptStatus = useRazorpayScript();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<CheckoutOrderState>("idle");
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    invoiceId: string;
    amountPaise: number;
    currency: string;
    keyId: string;
    isTestMode: boolean;
    environmentLabel: string;
  } | null>(null);

  const activePackages = allPackages.filter((p) => p.is_active);

  const getPrice = useCallback((pkg: PackageInfo) => {
    const pricing = pkg._pricing ?? [];
    const found = pricing.find((p) => p.billing_period === billingCycle);
    return found?.price ?? pkg.price;
  }, [billingCycle]);

  const getAnnualEffectiveMonthly = useCallback((pkg: PackageInfo) => {
    const pricing = pkg._pricing ?? [];
    const annualPrice = pricing.find((p) => p.billing_period === "annual")?.price;
    return annualPrice ? Math.round(annualPrice / 12) : 0;
  }, []);

  const getMonthlyPrice = useCallback((pkg: PackageInfo) => {
    const pricing = pkg._pricing ?? [];
    return pricing.find((p) => p.billing_period === "monthly")?.price ?? 0;
  }, []);

  const selectedPkg = selectedPkgId ? activePackages.find((p) => p.id === selectedPkgId) ?? null : null;
  const price = selectedPkg ? getPrice(selectedPkg) : 0;
  const monthlyPrice = selectedPkg ? getMonthlyPrice(selectedPkg) : 0;
  const annualEffMonthly = selectedPkg ? getAnnualEffectiveMonthly(selectedPkg) : 0;
  const annualSavings = monthlyPrice * 12 - price;

  const handlePay = useCallback(async () => {
    if (!selectedPkgId) return;
    const Razorpay = (window as RazorpayWindow).Razorpay;
    if (scriptStatus !== "loaded" || !Razorpay) {
      showToast("Razorpay is not loaded. Please refresh and try again.", "error");
      return;
    }

    setPaymentState("creating_order");
    setOrderResult(null);

    const result = await createSecureSubscriptionCheckoutOrderAction({
      targetPackageId: selectedPkgId,
      billingCycle,
    });

    if (!result.success) {
      showToast(result.error, "error");
      setPaymentState("payment_failed");
      return;
    }

    if (!result.razorpayOrderId || !result.invoiceId) {
      showToast("Failed to create payment order.", "error");
      setPaymentState("payment_failed");
      return;
    }

    setOrderResult({
      orderId: result.razorpayOrderId,
      invoiceId: result.invoiceId,
      amountPaise: result.amountPaise,
      currency: result.currency,
      keyId: result.razorpayKeyId,
      isTestMode: result.isTestMode,
      environmentLabel: result.environmentLabel,
    });

    const options = {
      key: result.razorpayKeyId,
      amount: result.amountPaise,
      currency: result.currency,
      order_id: result.razorpayOrderId,
      name: organizationName || "Gym Management",
      description: `${result.packageDisplayName} — ${billingCycle === "annual" ? "Annual" : "Monthly"}`,
      prefill: {
        name: result.organizationDisplayName || organizationName,
        email: customerEmail,
        contact: customerContact || "",
      },
      theme: { color: "#6366f1" },
      modal: {
        ondismiss: () => {
          setPaymentState("checkout_cancelled");
          showToast("Payment cancelled.", "info");
        },
        confirm_close: true,
      },
      handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        setPaymentState("payment_callback_received");
        showToast("Payment received. Confirming...", "info");

        const ackResult = await acknowledgeRazorpayCheckoutResultAction({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });

        if (ackResult.success) {
          if (ackResult.status === "already_processed" || ackResult.status === "payment_confirmed") {
            setPaymentState("payment_confirmed");
            showToast("Payment confirmed! Your subscription is active.", "success");
            window.location.reload();
          } else {
            setPaymentState("waiting_for_webhook");
            showToast(ackResult.warning || "Payment received. Confirmation is in progress.", "info");
            const checkInterval = setInterval(async () => {
              const statusResult = await getSubscriptionPaymentStatusAction({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (statusResult.success && statusResult.status === "payment_confirmed") {
                clearInterval(checkInterval);
                setPaymentState("payment_confirmed");
                showToast("Payment confirmed! Your subscription is active.", "success");
                window.location.reload();
              }
            }, 5000);
            setTimeout(() => clearInterval(checkInterval), 120000);
          }
        } else {
          setPaymentState("payment_failed");
          showToast(ackResult.error || "Payment verification failed. Please contact support.", "error");
        }
      },
    };

    try {
      const rzp = new Razorpay(options);
      rzp.open();
      setPaymentState("checkout_open");
    } catch {
      showToast("Failed to open Razorpay checkout.", "error");
      setPaymentState("payment_failed");
    }
  }, [selectedPkgId, billingCycle, scriptStatus, organizationName, customerEmail, customerContact]);

  const isLoading = paymentState === "creating_order";

  return (
    <div className="space-y-6">
      <ToastContainer />

      {scriptStatus === "loading" && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-4 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading payment gateway...
        </div>
      )}

      {scriptStatus === "error" && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="size-5 shrink-0" />
          <div><p className="font-bold">Payment gateway failed to load</p><p className="text-xs mt-1">Please refresh the page or try again later.</p></div>
        </div>
      )}

      <div className={cn(
        "flex items-center gap-2 rounded-lg border p-3 text-xs",
        orderResult?.isTestMode
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : orderResult
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-border bg-surface text-muted-foreground"
      )}>
        <Shield className="size-4" />
        <span>
          {orderResult
            ? <><strong>{orderResult.environmentLabel}:</strong> {orderResult.isTestMode ? "No real charges will be made." : "Live Razorpay charges are enabled."}</>
            : "Razorpay checkout mode will be confirmed before payment opens."}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">Billing:</span>
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={cn("px-5 py-2.5 text-sm font-bold transition", billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground")}
            type="button"
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("annual")}
            className={cn("relative px-5 py-2.5 text-sm font-bold transition border-l border-border", billingCycle === "annual" ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground")}
            type="button"
          >
            Annual
            <span className="absolute -top-2 -right-2 rounded-full bg-green-500 px-1.5 py-0.5 text-[8px] font-bold text-white leading-none shadow-sm">Save</span>
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {activePackages.map((pkg) => {
          const pkgPrice = billingCycle === "annual"
            ? pkg._pricing?.find((p) => p.billing_period === "annual")?.price ?? pkg.price
            : pkg._pricing?.find((p) => p.billing_period === "monthly")?.price ?? pkg.price;
          const pkgMonthlyPrice = pkg._pricing?.find((p) => p.billing_period === "monthly")?.price ?? pkg.price;
          const isSelected = selectedPkgId === pkg.id;
          const limits = pkg._limits ?? {};
          const maxMembers = readNumericLimit(limits, "max_members");
          const maxBranches = readNumericLimit(limits, "max_branches");
          const maxStaff = readNumericLimit(limits, "max_staff");

          return (
            <button
              key={pkg.id}
              onClick={() => { setSelectedPkgId(pkg.id); setPaymentState("idle"); setOrderResult(null); }}
              className={cn(
                "relative rounded-xl border-2 bg-gradient-to-b from-background to-accent/5 p-6 text-left transition-all hover:shadow-lg",
                isSelected ? "border-primary shadow-md ring-1 ring-primary/20" : "border-border",
                currentPackageId === pkg.id ? "ring-2 ring-indigo-400" : ""
              )}
              type="button"
              disabled={isLoading}
            >
              {currentPackageId === pkg.id && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-indigo-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">Current</span>
              )}
              <p className="text-lg font-black">{pkg.name}</p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-black">₹{Intl.NumberFormat("en-IN").format(Math.round(pkgPrice / 100))}</span>
                <span className="text-sm text-muted-foreground">/{billingCycle === "annual" ? "year" : "month"}</span>
              </div>

              {billingCycle === "annual" && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-green-600 font-semibold">₹{Intl.NumberFormat("en-IN").format(Math.round((pkgPrice / 12) / 100))}/mo effective</p>
                  <p className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700 border border-green-200">
                    Save ₹{Intl.NumberFormat("en-IN").format(Math.round((pkgMonthlyPrice * 12 - pkgPrice) / 100))} · 2 months free
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {isVisibleLimit(maxMembers) && (
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold">
                    {formatLimit(maxMembers)} members
                  </span>
                )}
                {isVisibleLimit(maxBranches) && (
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold">
                    {formatLimit(maxBranches)} branches
                  </span>
                )}
                {isVisibleLimit(maxStaff) && (
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold">
                    {formatLimit(maxStaff)} staff
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <CreditCard className="size-8 text-purple-500" />
            <h3 className="text-lg font-black">Enterprise Plan</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Need unlimited members, branches, and white-label features? Contact our sales team for a custom enterprise plan.
            </p>
            <Button variant="primary" onClick={() => window.open("mailto:sales@example.com", "_blank")} type="button">
              Contact Sales
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedPkg && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{selectedPkg.name} · {billingCycle === "annual" ? "Annual" : "Monthly"}</p>
                <p className="text-xs text-muted-foreground">
                  ₹{Intl.NumberFormat("en-IN").format(Math.round(price / 100))}/{billingCycle === "annual" ? "yr" : "mo"}
                  {billingCycle === "annual" && monthlyPrice > 0 && (
                    <span className="text-green-600 ml-2 font-semibold">
                      Save ₹{Intl.NumberFormat("en-IN").format(Math.round(annualSavings / 100))} · 2 months free
                    </span>
                  )}
                </p>
              </div>
              <Check className="size-5 text-green-600" />
            </div>

            {paymentState === "waiting_for_webhook" && (
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <Loader2 className="size-5 animate-spin shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Payment received</p>
                  <p className="text-xs mt-0.5">Payment is being processed. Confirmation is in progress. Your plan will activate shortly. You do not need to pay again.</p>
                </div>
              </div>
            )}

            {paymentState === "payment_confirmed" && (
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <Check className="size-5 shrink-0 mt-0.5" />
                <div><p className="font-bold">Payment confirmed</p><p className="text-xs mt-0.5">Your subscription is now active.</p></div>
              </div>
            )}

            {paymentState === "payment_failed" && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <div><p className="font-bold">Payment failed</p><p className="text-xs mt-0.5">Please try again or contact support.</p></div>
              </div>
            )}

            {paymentState === "checkout_cancelled" && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <X className="size-5 shrink-0 mt-0.5" />
                <div><p className="font-bold">Payment cancelled</p><p className="text-xs mt-0.5">You can try again when ready.</p></div>
              </div>
            )}

            {paymentState === "creating_order" && (
              <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <Loader2 className="size-5 animate-spin" />
                <span>Creating payment order...</span>
              </div>
            )}

            {paymentState === "payment_callback_received" && (
              <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <Loader2 className="size-5 animate-spin" />
                <span>Verifying payment...</span>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              className="w-full gap-2"
              onClick={handlePay}
              disabled={isLoading || paymentState === "waiting_for_webhook" || paymentState === "payment_confirmed" || paymentState === "payment_callback_received" || scriptStatus !== "loaded"}
              type="button"
            >
              {isLoading ? <Loader2 className="size-5 animate-spin" /> : <CreditCard className="size-5" />}
              {isLoading ? "Creating Order..." : paymentState === "waiting_for_webhook" ? "Awaiting Confirmation" : paymentState === "payment_confirmed" ? "Active" : `Pay ₹${Intl.NumberFormat("en-IN").format(Math.round(price / 100))} via Razorpay`}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              Secured by Razorpay · Test mode — no real charges
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function readNumericLimit(limits: Record<string, unknown>, key: string): number | null {
  const value = limits[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isVisibleLimit(value: number | null): value is number {
  return value === -1 || (value !== null && value > 0);
}

function formatLimit(value: number): string {
  return value === -1 ? "Unlimited" : Intl.NumberFormat("en-IN").format(value);
}
