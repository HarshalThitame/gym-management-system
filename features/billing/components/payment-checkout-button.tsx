"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/features/billing/lib/money";

type RazorpayOrderData = {
  keyId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
};

type ApiResponse<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: { code?: string; message: string } };

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error?: {
    description?: string;
    reason?: string;
  };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

type PaymentCheckoutButtonProps = {
  paymentId: string;
  amount: number;
  memberName?: string | null | undefined;
  memberEmail?: string | null | undefined;
  memberPhone?: string | null | undefined;
  label?: string;
};

export function PaymentCheckoutButton({
  paymentId,
  amount,
  memberName,
  memberEmail,
  memberPhone,
  label = "Pay Online"
}: PaymentCheckoutButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleCheckout() {
    setStatus("loading");
    setMessage(null);

    const scriptReady = await loadRazorpayScript();
    if (!scriptReady || !window.Razorpay) {
      setStatus("error");
      setMessage("Razorpay checkout could not be loaded. Check your network and try again.");
      return;
    }

    const orderResponse = await fetch("/api/billing/razorpay/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId })
    });
    const orderPayload = await orderResponse.json() as ApiResponse<RazorpayOrderData>;

    if (!orderPayload.ok) {
      setStatus("error");
      setMessage(orderPayload.error.message);
      return;
    }

    const prefill: NonNullable<RazorpayOptions["prefill"]> = {};
    if (memberName) {
      prefill.name = memberName;
    }
    if (memberEmail) {
      prefill.email = memberEmail;
    }
    if (memberPhone) {
      prefill.contact = memberPhone;
    }

    const checkout = new window.Razorpay({
      key: orderPayload.data.keyId,
      amount: orderPayload.data.amount,
      currency: orderPayload.data.currency,
      name: "Apex Fitness",
      description: `Membership payment ${formatCurrency(amount)}`,
      order_id: orderPayload.data.orderId,
      prefill,
      theme: { color: "#111827" },
      handler: (response) => {
        void verifyPayment(response);
      }
    });

    checkout.on("payment.failed", (response) => {
      setStatus("error");
      setMessage(response.error?.description ?? response.error?.reason ?? "Payment failed. Please try again.");
    });
    checkout.open();
  }

  async function verifyPayment(response: RazorpaySuccessResponse) {
    setStatus("verifying");
    const verifyResponse = await fetch("/api/billing/razorpay/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        signature: response.razorpay_signature
      })
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
    <div className="space-y-2">
      <Button disabled={status === "loading" || status === "verifying"} onClick={handleCheckout} size="sm" variant="accent">
        {status === "loading" ? "Preparing..." : status === "verifying" ? "Verifying..." : label}
      </Button>
      {message ? <p className="text-xs font-semibold text-muted-foreground" role="status">{message}</p> : null}
    </div>
  );
}

function loadRazorpayScript() {
  if (window.Razorpay) {
    return Promise.resolve(true);
  }

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
