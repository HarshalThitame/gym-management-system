"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, CreditCard, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/features/billing/lib/money";

type RazorpayCheckoutData = {
  provider: "razorpay";
  keyId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
};

type CheckoutData = RazorpayCheckoutData;

type ApiResponse<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: { code?: string; message: string } };

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error?: { description?: string; reason?: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      handler: (response: RazorpaySuccessResponse) => void;
      prefill?: { name?: string; email?: string; contact?: string };
      theme?: { color?: string };
    }) => {
      open: () => void;
      on: (event: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
    };
  }
}

type PaymentCheckoutButtonProps = {
  paymentId: string;
  amount: number;
  memberName?: string | null;
  memberEmail?: string | null;
  memberPhone?: string | null;
  label?: string;
};

export function PaymentCheckoutButton({
  paymentId,
  amount,
  memberName,
  memberEmail,
  memberPhone,
  label = "Pay Online",
}: PaymentCheckoutButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleCheckout() {
    setStatus("loading");
    setMessage(null);

    const orderResponse = await fetch("/api/billing/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId,
        payerName: memberName,
        payerEmail: memberEmail,
        payerPhone: memberPhone,
      }),
    });

    const payload = await orderResponse.json() as ApiResponse<CheckoutData>;
    if (!payload.ok) {
      setStatus("error");
      setMessage(payload.error.message);
      return;
    }

    const data = payload.data;

    const scriptReady = await loadRazorpayScript();
    if (!scriptReady || !window.Razorpay) {
      setStatus("error");
      setMessage("Payment gateway could not be loaded. Check your network and try again.");
      return;
    }

    const prefill: Record<string, string> = {};
    if (memberName) prefill.name = memberName;
    if (memberEmail) prefill.email = memberEmail;
    if (memberPhone) prefill.contact = memberPhone;

    const checkout = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: "Apex Fitness",
      description: `Membership payment ${formatCurrency(amount)}`,
      order_id: data.orderId,
      prefill: Object.keys(prefill).length > 0 ? prefill as { name?: string; email?: string; contact?: string } : undefined,
      theme: { color: "#111827" },
      handler: (response) => verifyPayment(response),
    });

    checkout.on("payment.failed", (response) => {
      setStatus("error");
      setMessage(response.error?.description ?? response.error?.reason ?? "Payment failed. Please try again.");
    });

    checkout.open();
  }

  async function verifyPayment(response: RazorpaySuccessResponse) {
    setStatus("verifying");
    const verifyResponse = await fetch("/api/billing/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        signature: response.razorpay_signature,
      }),
    });
    const verifyPayload = await verifyResponse.json() as ApiResponse<{ paymentId: string; status: string }>;
    if (!verifyPayload.ok) {
      setStatus("error");
      setMessage(verifyPayload.error.message);
      return;
    }
    setStatus("success");
    setMessage("Payment verified.");
    window.location.reload();
  }

  return (
    <Card variant="glass-dark" className="overflow-hidden border-white/10 bg-slate-950/80 text-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)]">
      <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="member-info" className="gap-1.5 border-white/15 text-white">
                <ShieldCheck className="size-3.5" />
                Secure checkout
              </Badge>
              <Badge variant="member-gradient" className="gap-1.5 border-white/15 text-white">
                <Sparkles className="size-3.5" />
                Gym gateway
              </Badge>
            </div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Online payment</p>
            <h3 className="text-2xl font-black tracking-tight">{formatCurrency(amount)}</h3>
            <p className="max-w-xl text-sm leading-6 text-white/70">
              Your payment will open in the gateway configured by your gym or organization. Card data is handled directly by the provider.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right backdrop-blur">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/50">Current state</p>
            <p className="mt-1 text-sm font-bold capitalize text-white">
              {status === "idle" ? "Ready" : status === "loading" ? "Preparing" : status === "verifying" ? "Verifying" : status}
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
              <CreditCard className="size-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">One-click checkout</p>
              <p className="text-xs leading-5 text-white/60">Open the provider modal, complete payment, and return here automatically.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <BadgeCheck className="size-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Verified completion</p>
              <p className="text-xs leading-5 text-white/60">We verify the signature server-side before marking your invoice paid.</p>
            </div>
          </div>
        </div>

        <Button
          disabled={status === "loading" || status === "verifying"}
          onClick={handleCheckout}
          size="lg"
          variant="accent"
          className="w-full justify-between rounded-2xl px-5 py-6 text-base font-black shadow-[0_16px_30px_rgba(59,130,246,0.25)]"
        >
          <span className="flex items-center gap-2">
            {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            {status === "loading" ? "Preparing secure checkout" : status === "verifying" ? "Verifying payment" : label}
          </span>
          <ArrowRight className="size-4" />
        </Button>

        {message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
              status === "error"
                ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
            }`}
            role="status"
          >
            {message}
          </div>
        ) : (
          <p className="text-xs leading-5 text-white/50">
            Payments are routed through the correct provider for your gym. If the gateway is unavailable, refresh and try again.
          </p>
        )}

      <form ref={formRef} method="POST" action="#" className="hidden" />
      </CardContent>
    </Card>
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
