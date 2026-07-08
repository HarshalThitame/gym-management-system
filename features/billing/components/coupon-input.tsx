"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Tag, XCircle } from "lucide-react";
import { formatCurrency } from "@/features/billing/lib/money";

type AppliedCoupon = {
  id: string;
  code: string;
  name: string;
  discountType: "percentage" | "fixed";
  valueAmount: number;
  appliedDiscount: number;
  discountedAmount: number;
};

type CouponInputProps = {
  amount: number;
  gymId?: string;
  invoiceId?: string;
  onCouponApplied?: (coupon: AppliedCoupon | null) => void | Promise<void>;
};

export function CouponInput({ amount, invoiceId, onCouponApplied }: CouponInputProps) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleApply() {
    const trimmed = code.trim();
    if (!trimmed) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const endpoint = invoiceId ? "/api/billing/coupons/apply" : "/api/billing/coupons/validate";
      const body = invoiceId ? { code: trimmed, invoiceId } : { code: trimmed, amount };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("invalid");
        setErrorMessage(data.error || data.error || "Invalid promo code");
        return;
      }

      if (!data.ok) {
        setStatus("invalid");
        setErrorMessage(data.error || "Promo code could not be applied");
        return;
      }

      const couponData: AppliedCoupon = {
        id: data.coupon.id,
        code: data.coupon.code,
        name: data.coupon.name,
        discountType: data.coupon.discountType,
        valueAmount: data.coupon.valueAmount,
        appliedDiscount: data.coupon.appliedDiscount,
        discountedAmount: data.coupon.discountedAmount,
      };

      setStatus("valid");
      setAppliedCoupon(couponData);
      onCouponApplied?.(couponData);
      if (invoiceId) {
        setTimeout(() => window.location.reload(), 800);
      }
    } catch {
      setStatus("invalid");
      setErrorMessage("Network error. Please try again.");
    }
  }

  async function handleRemove() {
    if (invoiceId && appliedCoupon) {
      try {
        await fetch("/api/billing/coupons/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId }),
        });
      } catch { /* silent */ }
    }
    setCode("");
    setStatus("idle");
    setAppliedCoupon(null);
    setErrorMessage("");
    onCouponApplied?.(null);
  }

  return (
    <div className="space-y-2">
      {appliedCoupon ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">{appliedCoupon.code}</p>
                <p className="text-xs text-emerald-600">
                  {appliedCoupon.discountType === "percentage"
                    ? `${appliedCoupon.valueAmount}% off`
                    : `${formatCurrency(appliedCoupon.valueAmount)} off`}
                  {appliedCoupon.appliedDiscount > 0
                    ? ` — saved ${formatCurrency(appliedCoupon.appliedDiscount)}`
                    : ""}
                </p>
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
              type="button"
            >
              Remove
            </button>
          </div>
          {!invoiceId ? (
            <>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-emerald-700">Original</span>
                <span className="text-emerald-700">{formatCurrency(amount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-emerald-800">Discounted</span>
                <span className="text-emerald-800">{formatCurrency(appliedCoupon.discountedAmount)}</span>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setStatus("idle"); setErrorMessage(""); }}
              placeholder="Enter promo code"
              className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm uppercase"
              maxLength={50}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApply(); } }}
            />
          </div>
          <button
            onClick={handleApply}
            disabled={status === "loading" || !code.trim()}
            className="flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
            type="button"
          >
            {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
            Apply
          </button>
        </div>
      )}

      {status === "invalid" && errorMessage ? (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <XCircle className="size-3.5" />
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
