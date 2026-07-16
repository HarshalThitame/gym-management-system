import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AuthContext } from "@/types/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { billingLogger } from "@/features/billing/lib/logger";
import { getProviderForGym } from "@/features/billing/providers/provider-registry";
import type { IPaymentProvider, PaymentProviderName } from "@/features/billing/providers/provider-types";

type AppSupabase = SupabaseClient<Database>;
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type RefundRow = Database["public"]["Tables"]["refunds"]["Row"];

type Result<TData> = { ok: true; data: TData } | { ok: false; status: number; code: string; message: string };

function requireAdminClient(): { ok: true; data: AppSupabase } | { ok: false; status: number; code: string; message: string } {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, status: 500, code: "DB_NOT_CONFIGURED", message: "Database not configured" };
  return { ok: true, data: admin };
}

export async function getProviderForPayment(payment: PaymentRow): Promise<{
  ok: true;
  provider: IPaymentProvider;
  providerName: PaymentProviderName;
} | {
  ok: false;
  status: number;
  code: string;
  message: string;
}> {
  const providerName = (payment.provider || "razorpay") as PaymentProviderName;
  const result = await getProviderForGym(payment.gym_id || "", providerName);
  if (!result.ok) {
    return { ok: false, status: 503, code: "PROVIDER_NOT_AVAILABLE", message: `Payment provider ${providerName} is not configured` };
  }
  return result;
}

export async function createPaymentOrder(context: AuthContext, paymentId: string): Promise<Result<{
  provider: PaymentProviderName;
  keyId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
}>> {
  const supabase = await createSupabaseServerClient();
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle() as never as {
    data: PaymentRow | null;
    error: { message: string } | null;
  };

  if (error || !payment) {
    return { ok: false, status: 404, code: "PAYMENT_NOT_FOUND", message: "Payment not found" };
  }

  if (payment.provider_order_id) {
    const providerResult = await getProviderForPayment(payment);
    if (!providerResult.ok) return providerResult;
    return {
      ok: true,
      data: {
        provider: providerResult.providerName,
        keyId: providerResult.provider.getPublicKey(),
        paymentId: payment.id,
        orderId: payment.provider_order_id,
        amount: payment.amount,
        currency: payment.currency,
      },
    };
  }

  const providerResult = await getProviderForPayment(payment);
  if (!providerResult.ok) return providerResult;
  const { provider, providerName } = providerResult;

  const orderResult = await provider.createOrder({
    amountInRupees: payment.amount / 100,
    currency: payment.currency,
    receipt: `PAY_${payment.id.slice(0, 8)}_${Date.now()}`,
    notes: {
      payment_id: payment.id,
      invoice_id: payment.invoice_id || "",
      member_id: payment.member_id,
      gym_id: payment.gym_id || "",
    },
  });

  if (!orderResult.ok) {
    return { ok: false, status: 503, code: "ORDER_CREATION_FAILED", message: orderResult.message };
  }

  const admin = requireAdminClient();
  if (!admin.ok) return admin;

  const { error: updateError } = await admin.data
    .from("payments")
    .update({
      status: "processing",
      provider: providerName,
      provider_order_id: orderResult.data.id,
    } as never)
    .eq("id", payment.id)
    .in("status", ["pending", "processing", "failed"]);

  if (updateError) {
    return { ok: false, status: 500, code: "PAYMENT_UPDATE_FAILED", message: "Could not attach provider order" };
  }

  billingLogger.info("createPaymentOrder", "Order created", {
    paymentId: payment.id,
    provider: providerName,
    orderId: orderResult.data.id,
  });

  return {
    ok: true,
    data: {
      provider: providerName,
      keyId: provider.getPublicKey(),
      paymentId: payment.id,
      orderId: orderResult.data.id,
      amount: payment.amount,
      currency: payment.currency,
    },
  };
}

export async function verifyPayment(
  context: AuthContext,
  input: { orderId: string; paymentId: string; signature: string },
): Promise<Result<{ paymentId: string; status: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("provider_order_id", input.orderId)
    .maybeSingle() as never as {
    data: PaymentRow | null;
    error: { message: string } | null;
  };

  if (error || !payment) {
    return { ok: false, status: 404, code: "PAYMENT_NOT_FOUND", message: "Payment not found by order ID" };
  }

  const providerResult = await getProviderForPayment(payment);
  if (!providerResult.ok) return providerResult;
  const { provider, providerName } = providerResult;

  const verification = await provider.verifyPayment({
    providerOrderId: input.orderId,
    providerPaymentId: input.paymentId,
    providerSignature: input.signature,
  });

  if (!verification.isValid) {
    return { ok: false, status: 400, code: "VERIFICATION_FAILED", message: verification.error || "Payment verification failed" };
  }

  const admin = requireAdminClient();
  if (!admin.ok) return admin;

  const paidAt = new Date().toISOString();
  const { error: updateError } = await admin.data
    .from("payments")
    .update({
      status: "paid",
      provider: providerName,
      provider_payment_id: input.paymentId,
      provider_signature: input.signature,
      paid_at: paidAt,
      collected_at: paidAt,
      failed_at: null,
      failure_reason: null,
    } as never)
    .eq("id", payment.id)
    .in("status", ["pending", "processing", "failed"]);

  if (updateError) {
    return { ok: false, status: 500, code: "PAYMENT_UPDATE_FAILED", message: "Could not mark payment as paid" };
  }

  billingLogger.info("verifyPayment", "Payment verified", {
    paymentId: payment.id,
    provider: providerName,
    providerPaymentId: input.paymentId,
  });

  return { ok: true, data: { paymentId: payment.id, status: "paid" } };
}

export async function createRefund(
  context: AuthContext,
  input: { paymentId: string; amount: number; reason: string; notes?: string | null },
): Promise<Result<{ refundId: string; providerRefundId: string | null; status: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", input.paymentId)
    .maybeSingle() as never as {
    data: PaymentRow | null;
    error: { message: string } | null;
  };

  if (error || !payment) {
    return { ok: false, status: 404, code: "PAYMENT_NOT_FOUND", message: "Payment not found" };
  }

  if (payment.status !== "paid" && payment.status !== "partially_refunded") {
    return { ok: false, status: 409, code: "PAYMENT_NOT_PAID", message: "Only paid payments can be refunded" };
  }

  const providerResult = await getProviderForPayment(payment);
  if (!providerResult.ok) return providerResult;
  const { provider, providerName } = providerResult;

  const refundResult = await provider.createRefund({
    paymentId: payment.provider_payment_id || input.paymentId,
    amountInPaise: input.amount,
    notes: {
      payment_id: payment.id,
      reason: input.reason.slice(0, 200),
      notes: (input.notes ?? "").slice(0, 200),
    },
  });

  if (!refundResult.ok) {
    return { ok: false, status: 503, code: "REFUND_FAILED", message: refundResult.message };
  }

  const admin = requireAdminClient();
  if (!admin.ok) return admin;

  const processedAt = new Date().toISOString();
  const refundStatus: RefundRow["status"] = refundResult.data.status === "processed" ? "processed" : "processing";

  const { data: refund, error: refundError } = await admin.data
    .from("refunds")
    .insert({
      gym_id: payment.gym_id,
      payment_id: payment.id,
      invoice_id: payment.invoice_id,
      member_id: payment.member_id,
      amount: input.amount,
      currency: payment.currency,
      status: refundStatus,
      reason: input.reason,
      metadata: {
        reason: input.reason,
        notes: input.notes ?? null,
        payment_id: payment.id,
        provider_refund_id: refundResult.data.id,
      } as never,
      provider_refund_id: refundResult.data.id,
      approved_by: context.userId,
      requested_by: context.userId,
      processed_at: refundStatus === "processed" ? processedAt : null,
    } as never)
    .select("id,status,provider_refund_id")
    .maybeSingle() as never as {
    data: { id: string; status: string; provider_refund_id: string | null } | null;
    error: { message: string } | null;
  };

  if (refundError || !refund) {
    return { ok: false, status: 500, code: "REFUND_SAVE_FAILED", message: "Refund record could not be saved" };
  }

  await admin.data
    .from("payments")
    .update({ status: refundStatus === "processed" ? "refunded" : "partially_refunded" } as never)
    .eq("id", payment.id);

  billingLogger.info("createRefund", "Refund created", {
    paymentId: payment.id,
    provider: providerName,
    refundId: refund.id,
  });

  return {
    ok: true,
    data: { refundId: refund.id, providerRefundId: refund.provider_refund_id, status: refund.status },
  };
}
