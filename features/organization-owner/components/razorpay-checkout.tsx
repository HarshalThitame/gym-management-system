"use client";

import { useState, useCallback, useEffect } from "react";
import { CreditCard, Loader2, Check, AlertTriangle, Shield, Clock, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { useRazorpayScript } from "@/features/billing/razorpay/use-razorpay-script";
import { createSubscriptionRazorpayOrderAction } from "@/features/subscription/razorpay-order-action";
import { verifySubscriptionRazorpayPaymentAction } from "@/features/subscription/razorpay-verify-action";
import type { RazorpayCheckoutResponse, PaymentState } from "@/features/billing/razorpay/razorpay-checkout-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PackageInfo = any;

type RazorpayCheckoutProps = {
  organizationId: string;
  organizationName: string;
  customerEmail: string;
  customerContact?: string;
  allPackages: any[];
  currentPackageId?: string | null;
  currentSubscriptionId?: string | null;
  onPaymentSuccess?: (response: RazorpayCheckoutResponse & { invoiceId: string; packageId: string; billingCycle: string }) => void;
};

export function RazorpayCheckout({
  organizationId,
  organizationName,
  customerEmail,
  customerContact,
  allPackages,
  currentPackageId,
  currentSubscriptionId,
  onPaymentSuccess,
}: RazorpayCheckoutProps) {
  const scriptStatus = useRazorpayScript();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [orderResult, setOrderResult] = useState<{
    orderId: string; invoiceId: string; amount: number; currency: string; keyId: string;
  } | null>(null);
  const [razorpayResponse, setRazorpayResponse] = useState<RazorpayCheckoutResponse | null>(null);

  const activePackages = allPackages.filter((p) => p.is_active && p.slug !== "enterprise");

  const getPrice = useCallback((pkg: PackageInfo) => {
    const pricing = (pkg as any)._pricing ?? [];
    const found = pricing.find((p: any) => p.billing_period === billingCycle);
    return found?.price ?? pkg.price;
  }, [billingCycle]);

  const getAnnualEffectiveMonthly = useCallback((pkg: PackageInfo) => {
    const pricing = (pkg as any)._pricing ?? [];
    const annualPrice = pricing.find((p: any) => p.billing_period === "annual")?.price;
    return annualPrice ? Math.round(annualPrice / 12) : 0;
  }, []);

  const getMonthlyPrice = useCallback((pkg: PackageInfo) => {
    const pricing = (pkg as any)._pricing ?? [];
    return pricing.find((p: any) => p.billing_period === "monthly")?.price ?? 0;
  }, []);

  const selectedPkg = selectedPkgId ? activePackages.find((p) => p.id === selectedPkgId) ?? null : null;
  const price = selectedPkg ? getPrice(selectedPkg) : 0;
  const monthlyPrice = selectedPkg ? getMonthlyPrice(selectedPkg) : 0;
  const annualEffMonthly = selectedPkg ? getAnnualEffectiveMonthly(selectedPkg) : 0;
  const annualSavings = monthlyPrice * 12 - price;

  const handlePay = useCallback(async () => {
    if (!selectedPkgId) return;
    if (scriptStatus !== "loaded" || !(window as any).Razorpay) {
      showToast("Razorpay is not loaded. Please refresh and try again.", "error");
      return;
    }

    setPaymentState("creating_order");
    setOrderResult(null);
    setRazorpayResponse(null);

    const result = await createSubscriptionRazorpayOrderAction({
      organizationId,
      packageId: selectedPkgId,
      billingCycle,
      subscriptionId: currentSubscriptionId ?? undefined,
    });

    if (!result.success || !result.orderId || !result.invoiceId) {
      showToast(result.error || "Failed to create payment order.", "error");
      setPaymentState("failed");
      return;
    }

    setOrderResult({
      orderId: result.orderId,
      invoiceId: result.invoiceId,
      amount: result.amount ?? 0,
      currency: result.currency ?? "INR",
      keyId: result.keyId ?? "",
    });

    const options: any = {
      key: result.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
      amount: result.amount ?? 0,
      currency: result.currency ?? "INR",
      order_id: result.orderId,
      name: process.env.NEXT_PUBLIC_APP_NAME || "Gym Management",
      description: `${result.packageName ?? "Subscription"} — ${billingCycle === "annual" ? "Annual" : "Monthly"}`,
      prefill: {
        name: result.organizationName || organizationName,
        email: result.customerEmail || customerEmail,
        contact: customerContact || "",
      },
      notes: {
        organization_id: organizationId,
        invoice_id: result.invoiceId,
        package_id: selectedPkgId,
        billing_cycle: billingCycle,
      },
      theme: { color: "#6366f1" },
      modal: {
        ondismiss: () => {
          setPaymentState("cancelled");
          showToast("Payment cancelled.", "info");
        },
        confirm_close: true,
      },
      handler: async (response: any) => {
        setRazorpayResponse(response as RazorpayCheckoutResponse);
        setPaymentState("creating_order");
        showToast("Verifying payment...", "info");

        const verifyInput: any = {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          invoiceId: result.invoiceId,
          organizationId,
          packageId: (selectedPkgId as string) || "",
        };
        if (currentSubscriptionId) verifyInput.subscriptionId = currentSubscriptionId;
        const verifyResult = await verifySubscriptionRazorpayPaymentAction(verifyInput);

        if (verifyResult.success) {
          setPaymentState("success_pending_verification");
          showToast("Payment verified! Your subscription is now active.", "success");
          if (onPaymentSuccess) onPaymentSuccess({ ...response, invoiceId: result.invoiceId, packageId: selectedPkgId || "", billingCycle });
          // Refresh the page to show updated subscription
          window.location.reload();
        } else {
          setPaymentState("failed");
          showToast(verifyResult.error || "Payment verification failed. Please contact support.", "error");
        }
      },
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
      setPaymentState("checkout_open");
    } catch {
      showToast("Failed to open Razorpay checkout.", "error");
      setPaymentState("failed");
    }
  }, [selectedPkgId, billingCycle, scriptStatus, organizationId, organizationName, customerEmail, customerContact, currentSubscriptionId, onPaymentSuccess]);

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

      {/* Test Mode Badge */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <Shield className="size-4" />
        <span><strong>Test Mode:</strong> Razorpay is in test mode. No real charges will be made.</span>
      </div>

      {/* Billing Cycle Toggle */}
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

      {/* Package Cards */}
      <div className="grid gap-5 lg:grid-cols-2">
        {activePackages.map((pkg) => {
          const pkgPrice = billingCycle === "annual"
            ? (pkg as any)._pricing?.find((p: any) => p.billing_period === "annual")?.price ?? pkg.price
            : (pkg as any)._pricing?.find((p: any) => p.billing_period === "monthly")?.price ?? pkg.price;
          const pkgMonthlyPrice = (pkg as any)._pricing?.find((p: any) => p.billing_period === "monthly")?.price ?? pkg.price;
          const isSelected = selectedPkgId === pkg.id;
          const limits = (pkg as any)._limits ?? {};

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
                    <Sparkles className="size-3" /> Save ₹{Intl.NumberFormat("en-IN").format(Math.round((pkgMonthlyPrice * 12 - pkgPrice) / 100))} · 2 months free
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {limits.max_members > 0 && (
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold">
                    {limits.max_members === -1 ? "Unlimited" : limits.max_members} members
                  </span>
                )}
                {limits.max_branches > 0 && (
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold">
                    {limits.max_branches === -1 ? "Unlimited" : limits.max_branches} branches
                  </span>
                )}
                {limits.max_staff > 0 && (
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold">
                    {limits.max_staff === -1 ? "Unlimited" : limits.max_staff} staff
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Enterprise card */}
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

      {/* Selected package summary and Pay button */}
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

            {/* Payment State Messages */}
            {paymentState === "success_pending_verification" && (
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <Check className="size-5 shrink-0 mt-0.5" />
                <div><p className="font-bold">Payment captured by Razorpay</p><p className="text-xs mt-0.5">Your payment is being processed. Backend verification and plan activation will follow shortly. You do not need to pay again.</p></div>
              </div>
            )}

            {paymentState === "failed" && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <div><p className="font-bold">Payment failed</p><p className="text-xs mt-0.5">Please try again or contact support.</p></div>
              </div>
            )}

            {paymentState === "cancelled" && (
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

            <Button
              variant="primary"
              size="lg"
              className="w-full gap-2"
              onClick={handlePay}
              disabled={isLoading || paymentState === "success_pending_verification" || scriptStatus !== "loaded"}
              type="button"
            >
              {isLoading ? <Loader2 className="size-5 animate-spin" /> : <CreditCard className="size-5" />}
              {isLoading ? "Creating Order..." : paymentState === "success_pending_verification" ? "Payment Received" : `Pay ₹${Intl.NumberFormat("en-IN").format(Math.round(price / 100))} via Razorpay`}
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
