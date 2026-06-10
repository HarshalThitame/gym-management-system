"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/features/billing/lib/money";

type ApiResponse<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: { code?: string; message: string; fieldErrors?: Record<string, string[]> } };

type PaymentRefundFormProps = {
  maxRefundableAmount: number;
  paymentId: string;
};

export function PaymentRefundForm({ maxRefundableAmount, paymentId }: PaymentRefundFormProps) {
  const router = useRouter();
  const maxRefundableMajor = useMemo(() => Math.max(maxRefundableAmount / 100, 0), [maxRefundableAmount]);
  const [amount, setAmount] = useState(maxRefundableMajor.toFixed(2));
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage(null);

    const amountInMinorUnits = Math.round(Number(amount) * 100);

    const response = await fetch("/api/billing/razorpay/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId,
        amount: amountInMinorUnits,
        reason
      })
    });
    const payload = await response.json() as ApiResponse<{ refundId: string; status: string }>;

    if (!payload.ok) {
      setStatus("error");
      setMessage(payload.error.message);
      return;
    }

    setStatus("success");
    setMessage(`Refund ${payload.data.status.replace(/_/g, " ")}.`);
    router.refresh();
  }

  return (
    <form className="grid gap-2 rounded-md border border-border bg-surface p-3 sm:grid-cols-[8rem_1fr_auto]" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor={`refundAmount-${paymentId}`}>Refund amount</label>
      <Input
        id={`refundAmount-${paymentId}`}
        max={maxRefundableMajor}
        min={0.01}
        onChange={(event) => setAmount(event.target.value)}
        step="0.01"
        type="number"
        value={amount}
      />
      <label className="sr-only" htmlFor={`refundReason-${paymentId}`}>Refund reason</label>
      <Textarea
        className="min-h-11 py-2"
        id={`refundReason-${paymentId}`}
        maxLength={500}
        minLength={3}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Refund reason"
        required
        value={reason}
      />
      <Button disabled={status === "submitting" || maxRefundableAmount <= 0} size="sm" type="submit" variant="destructive">
        {status === "submitting" ? "Refunding..." : "Issue Refund"}
      </Button>
      <p className="text-xs font-semibold text-muted-foreground sm:col-span-3" role="status">
        {message ?? `Refundable balance: ${formatCurrency(maxRefundableAmount)}`}
      </p>
    </form>
  );
}
