"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
    };
  }
}

type AutoBillingStatus = {
  hasPaymentMethod: boolean;
  hasActiveSubscription: boolean;
  autoRenewEnabled: boolean;
  paymentMethods: Array<{
    id: string;
    provider: string;
    payment_type: string;
    display_name: string;
    last_four: string | null;
    card_network: string | null;
    is_default: boolean;
  }>;
  subscriptions: Array<{
    id: string;
    status: string;
    provider_subscription_id: string | null;
    amount: number;
    billing_period: string;
  }>;
};

type SubscriptionSetupResponse = {
  ok: boolean;
  subscriptionId?: string;
  keyId?: string;
  error?: string;
  providerSubscriptionId?: string;
  customerId?: string;
};

type AutoRenewToggleProps = {
  membershipId: string;
  planPrice: number;
  planDurationDays: number;
  initialAutoRenew: boolean;
  initialStatus: AutoBillingStatus;
};

export function AutoRenewToggle({
  membershipId,
  planPrice,
  planDurationDays,
  initialAutoRenew,
  initialStatus,
}: AutoRenewToggleProps) {
  const router = useRouter();
  const [autoRenew, setAutoRenew] = useState(initialAutoRenew);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<AutoBillingStatus>(initialStatus);

  const billingPeriod = planDurationDays >= 365 ? "annual" : planDurationDays >= 180 ? "half_yearly" : planDurationDays >= 90 ? "quarterly" : "monthly";

  async function handleEnable() {
    setLoading(true);

    try {
      const setupRes = await fetch("/api/billing/member-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setup",
          membershipId,
          billingPeriod,
          amount: planPrice,
        }),
      });

      const setupData: SubscriptionSetupResponse & { providerSubscriptionId?: string; keyId?: string; customerId?: string } = await setupRes.json();

      if (!setupRes.ok || !setupData.ok) {
        showToast(setupData.error || "Failed to set up subscription", "error");
        return;
      }

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        showToast("Payment gateway could not be loaded", "error");
        return;
      }

      const checkout = new window.Razorpay({
        key: setupData.keyId,
        subscription_id: setupData.providerSubscriptionId,
        name: "Apex Fitness",
        description: `Auto-renewal setup - ${billingPeriod}`,
        handler: async (response: Record<string, unknown>) => {
          const r = response as unknown as RazorpaySuccessResponse;
          if (!r.razorpay_subscription_id) {
            showToast("Subscription authorization failed", "error");
            setLoading(false);
            return;
          }

          const confirmRes = await fetch("/api/billing/member-subscriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "confirm",
              membershipId,
              providerSubscriptionId: r.razorpay_subscription_id,
              providerPaymentId: r.razorpay_payment_id || "",
              providerCustomerId: setupData.customerId,
            }),
          });

          const confirmData = await confirmRes.json();
          if (!confirmRes.ok || !confirmData.ok) {
            showToast(confirmData.error || "Failed to activate subscription", "error");
            setLoading(false);
            return;
          }

          setAutoRenew(true);
          showToast("Auto-renew enabled successfully", "success");
          router.refresh();
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            showToast("Subscription setup cancelled", "info");
          },
        },
      });

      checkout.open();
    } catch {
      showToast("Network error", "error");
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);

    try {
      const res = await fetch("/api/billing/member-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disable",
          membershipId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.error || "Failed to disable auto-renew", "error");
        return;
      }

      setAutoRenew(false);
      showToast("Auto-renew disabled", "success");
      router.refresh();
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <p className="font-black">Auto-Renewal</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {autoRenew
              ? "Your membership will renew automatically. Your saved payment method will be charged each cycle."
              : "Enable auto-renewal to set up recurring payments and never miss a renewal."}
          </p>
          {status.hasActiveSubscription && status.subscriptions[0] ? (
            <p className="text-xs font-semibold text-emerald-600">
              Active &middot; {status.subscriptions[0].billing_period.replace(/_/g, " ")} charges
            </p>
          ) : null}
          {status.paymentMethods.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {status.paymentMethods[0].display_name}
              {status.paymentMethods[0].last_four ? ` (${status.paymentMethods[0].last_four})` : ""}
            </p>
          ) : null}
        </div>
        <div>
          {autoRenew ? (
            <Button size="sm" variant="secondary" onClick={handleDisable} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Disable
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={handleEnable} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Enable
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-razorpay-checkout]");
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
