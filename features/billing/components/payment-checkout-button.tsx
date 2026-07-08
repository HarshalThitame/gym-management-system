"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/features/billing/lib/money";

type RazorpayCheckoutData = {
  provider: "razorpay";
  keyId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
};

type PayuCheckoutData = {
  provider: "payu";
  paymentId: string;
  orderId: string;
  checkoutForm: {
    action: string;
    fields: Record<string, string>;
  };
};

type CheckoutData = RazorpayCheckoutData | PayuCheckoutData;

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
  const [payuForm, setPayuForm] = useState<{ action: string; fields: Record<string, string> } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (payuForm && formRef.current) {
      formRef.current.submit();
    }
  }, [payuForm]);

  async function handleCheckout() {
    setStatus("loading");
    setMessage(null);
    setPayuForm(null);

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

    if (data.provider === "payu") {
      setPayuForm(data.checkoutForm);
      return;
    }

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
    <div className="space-y-2">
      <Button
        disabled={status === "loading" || status === "verifying"}
        onClick={handleCheckout}
        size="sm"
        variant="accent"
      >
        {status === "loading" ? "Preparing..." : status === "verifying" ? "Verifying..." : label}
      </Button>
      {message ? <p className="text-xs font-semibold text-muted-foreground" role="status">{message}</p> : null}

      {payuForm ? (
        <form ref={formRef} method="POST" action={payuForm.action} className="hidden">
          {Object.entries(payuForm.fields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        </form>
      ) : null}
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
