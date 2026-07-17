"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, CreditCard, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/features/billing/lib/money";
import { useRazorpayScript } from "@/features/billing/razorpay/use-razorpay-script";
import { showToast, ToastContainer } from "@/components/ui/toast";

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
      prefill?: { name?: string; email?: string; contact?: string };
      theme?: { color?: string };
      handler: (response: RazorpaySuccessResponse) => void;
      modal?: {
        ondismiss?: () => void;
        confirm_close?: boolean;
      };
    }) => {
      open: () => void;
      on: (event: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
    };
  }
}

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; error: { code?: string; message: string } };

type CreateOrderResponse = ApiSuccess<{ order_id: string; amount: number; currency: string }> | ApiError;
type VerifyResponse = ApiSuccess<{ verified: true; order_id: string; payment_id: string }> | ApiError;

type RazorpayStandardCheckoutButtonProps = {
  title?: string;
  description?: string;
  buttonLabel?: string;
  defaultAmountRupees?: number;
  defaultReceipt?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  currency?: string;
};

export function RazorpayStandardCheckoutButton({
  title = "Razorpay Standard Checkout",
  description = "Create an order server-side, open the Razorpay modal, and verify the signature before accepting payment.",
  buttonLabel = "Start Checkout",
  defaultAmountRupees = 499,
  defaultReceipt = `receipt_${Date.now()}`,
  customerName = "",
  customerEmail = "",
  customerPhone = "",
  currency = "INR",
}: RazorpayStandardCheckoutButtonProps) {
  const [amountRupees, setAmountRupees] = useState(String(defaultAmountRupees));
  const [receipt, setReceipt] = useState(defaultReceipt);
  const [name, setName] = useState(customerName);
  const [email, setEmail] = useState(customerEmail);
  const [phone, setPhone] = useState(customerPhone);
  const [status, setStatus] = useState<"idle" | "creating" | "opened" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const scriptStatus = useRazorpayScript(true);

  const publicKeyId = useMemo(() => {
    return (
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      || process.env.NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID
      || process.env.NEXT_PUBLIC_RAZORPAY_LIVE_KEY_ID
      || ""
    );
  }, []);

  const amountPaise = useMemo(() => {
    const parsed = Number(amountRupees);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.max(100, Math.round(parsed * 100));
  }, [amountRupees]);

  async function handleCheckout() {
    setMessage(null);

    if (!publicKeyId) {
      setStatus("error");
      setMessage("Missing NEXT_PUBLIC_RAZORPAY_KEY_ID.");
      return;
    }

    if (amountPaise < 100) {
      setStatus("error");
      setMessage("Amount must be at least ₹1.00.");
      return;
    }

    if (scriptStatus !== "loaded" || !window.Razorpay) {
      setStatus("error");
      setMessage("Razorpay checkout.js could not be loaded.");
      return;
    }

    setStatus("creating");
    const orderResponse = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountPaise,
        currency,
        receipt,
      }),
    });

    const orderPayload = await orderResponse.json() as CreateOrderResponse;
    if (!orderPayload.ok) {
      setStatus("error");
      setMessage(orderPayload.error.message);
      return;
    }

    const checkout = new window.Razorpay({
      key: publicKeyId,
      amount: orderPayload.data.amount,
      currency: orderPayload.data.currency,
      name: title,
      description,
      order_id: orderPayload.data.order_id,
      prefill: {
        name: name || undefined,
        email: email || undefined,
        contact: phone || undefined,
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
      handler: async (response) => {
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

        const verifyPayload = await verifyResponse.json() as VerifyResponse;
        if (!verifyPayload.ok) {
          setStatus("error");
          setMessage(verifyPayload.error.message);
          showToast(verifyPayload.error.message, "error");
          return;
        }

        setStatus("success");
        setMessage(`Verified ${verifyPayload.data.payment_id}.`);
        showToast("Payment verified.", "success");
      },
    });

    checkout.on("payment.failed", (response) => {
      setStatus("error");
      setMessage(response.error?.description ?? response.error?.reason ?? "Payment failed.");
      showToast(response.error?.description ?? response.error?.reason ?? "Payment failed.", "error");
    });

    setStatus("opened");
    checkout.open();
  }

  return (
    <Card variant="elevated" className="border-border/70">
      <ToastContainer />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
            <CreditCard className="size-5 text-blue-700" />
          </div>
          <div>
            <h3 className="text-xl font-black">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Amount (INR)</label>
            <Input className="mt-1" inputMode="decimal" min="1" step="0.01" value={amountRupees} onChange={(event) => setAmountRupees(event.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Will be converted to {amountPaise} paise for the order request.</p>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Receipt</label>
            <Input className="mt-1" value={receipt} onChange={(event) => setReceipt(event.target.value)} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Name</label>
            <Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Email</label>
            <Input className="mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Phone</label>
            <Input className="mt-1" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Preview</p>
            <p className="mt-2 text-xl font-black">{formatCurrency(amountPaise, currency)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Receipt {receipt || "not set"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="accent"
            className="gap-2"
            disabled={status === "creating" || status === "verifying" || !publicKeyId}
            onClick={handleCheckout}
          >
            {status === "creating" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {status === "creating" ? "Creating order" : status === "verifying" ? "Verifying payment" : buttonLabel}
            <ArrowRight className="size-4" />
          </Button>

          <span className="text-xs text-muted-foreground">
            {status === "success"
              ? "Payment verified."
              : status === "error"
                ? "Checkout failed."
                : "Razorpay modal opens in a secure overlay."}
          </span>
        </div>

        {message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
              status === "error"
                ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
                : status === "success"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                  : "border-sky-500/20 bg-sky-500/10 text-sky-100"
            }`}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <p>{message}</p>
              <button type="button" onClick={() => setMessage(null)} className="text-current/70 hover:text-current" aria-label="Dismiss message">
                <X className="size-4" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="text-sm font-bold">Standard Checkout</p>
              <p className="text-xs leading-5 text-muted-foreground">Creates a Razorpay order server-side, opens the modal, and verifies the HMAC signature.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <BadgeCheck className="size-4" />
            </div>
            <div>
              <p className="text-sm font-bold">Signature safe</p>
              <p className="text-xs leading-5 text-muted-foreground">The secret key stays on the server. The client only receives the public key id.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
