import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";
import { calculateDiscount } from "@/features/billing/lib/money";

export type CouponValidationResult = {
  ok: true;
  coupon: {
    id: string;
    code: string;
    name: string;
    discountType: "percentage" | "fixed";
    valueAmount: number;
    maxDiscountAmount: number | null;
    minimumAmount: number;
    appliedDiscount: number;
    discountedAmount: number;
  };
} | {
  ok: false;
  message: string;
};

export async function validateAndApplyCoupon(params: {
  gymId: string;
  code: string;
  amount: number;
}): Promise<CouponValidationResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const normalizedCode = params.code.trim().toUpperCase();

  const { data: coupon } = await admin
    .from("coupons")
    .select("*")
    .eq("gym_id", params.gymId)
    .eq("code", normalizedCode)
    .maybeSingle() as never as {
    data: {
      id: string;
      code: string;
      name: string;
      discount_type: string;
      value_amount: number;
      max_discount_amount: number | null;
      minimum_amount: number;
      status: string;
      usage_limit: number | null;
      used_count: number;
      expires_at: string | null;
    } | null;
    error: { message: string } | null;
  };

  if (!coupon) return { ok: false, message: "Invalid promo code" };

  if (coupon.status !== "active") {
    return { ok: false, message: "This promo code is no longer active" };
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { ok: false, message: "This promo code has expired" };
  }

  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    return { ok: false, message: "This promo code has reached its usage limit" };
  }

  if (params.amount < coupon.minimum_amount) {
    return { ok: false, message: `Minimum purchase amount is ${(coupon.minimum_amount / 100).toFixed(0)}` };
  }

  const appliedDiscount = calculateDiscount({
    amount: params.amount,
    discountType: coupon.discount_type as "percentage" | "fixed",
    valueAmount: coupon.value_amount,
    maxDiscountAmount: coupon.max_discount_amount,
  });

  const discountedAmount = Math.max(params.amount - appliedDiscount, 0);

  billingLogger.info("validateAndApplyCoupon", "Coupon validated", {
    code: normalizedCode,
    originalAmount: params.amount,
    discount: appliedDiscount,
    discountedAmount,
  });

  return {
    ok: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      discountType: coupon.discount_type as "percentage" | "fixed",
      valueAmount: coupon.value_amount,
      maxDiscountAmount: coupon.max_discount_amount,
      minimumAmount: coupon.minimum_amount,
      appliedDiscount,
      discountedAmount,
    },
  };
}

export async function recordCouponUsage(couponId: string, memberId: string, invoiceId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const { data: coupon } = await admin
    .from("coupons")
    .select("used_count")
    .eq("id", couponId)
    .maybeSingle() as never as {
    data: { used_count: number } | null;
    error: { message: string } | null;
  };

  if (!coupon) return;

  await admin.from("coupons").update({
    used_count: (coupon.used_count ?? 0) + 1,
  } as never).eq("id", couponId);

  await admin.from("billing_events").insert({
    gym_id: null,
    event_type: "coupon_redeemed",
    entity_type: "invoice",
    entity_id: invoiceId,
    status: "recorded",
    metadata: { couponId, memberId },
  } as never);
}
