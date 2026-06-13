import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertFeature } from "@/lib/tenant";
import type { AuthContext } from "@/types/auth";
import type { Database, Json } from "@/types/database";
import { recordSubscriptionEvent } from "@/features/super-admin/services/subscription-events-service";
import { billingLogger } from "../lib/logger";
import {
  createRazorpayOrder,
  createRazorpayRefund,
  fetchRazorpayPayment,
  getRazorpayKeyId,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature
} from "../lib/razorpay";

type AppSupabase = SupabaseClient<Database>;
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type RefundRow = Database["public"]["Tables"]["refunds"]["Row"];
type PaymentAttemptStatus = NonNullable<Database["public"]["Tables"]["payment_attempts"]["Insert"]["status"]>;
type TransactionDirection = Database["public"]["Tables"]["transactions"]["Insert"]["direction"];
type TransactionType = Database["public"]["Tables"]["transactions"]["Insert"]["transaction_type"];
type BillingEventType = Database["public"]["Tables"]["billing_events"]["Insert"]["event_type"];
type Result<TData> = { ok: true; data: TData } | { ok: false; status: number; code: string; message: string };

type RazorpayOrderEntity = {
  id: string;
  amount: number;
  currency: string;
  status: string | null;
};

type RazorpayPaymentEntity = {
  id: string;
  orderId: string | null;
  amount: number;
  currency: string;
  status: string | null;
  captured: boolean;
  method: string | null;
  errorCode: string | null;
  errorDescription: string | null;
};

type RazorpayRefundEntity = {
  id: string;
  paymentId: string | null;
  amount: number;
  currency: string | null;
  status: string | null;
};

export async function createRazorpayOrderForPayment(context: AuthContext, paymentId: string): Promise<Result<{ keyId: string; paymentId: string; orderId: string; amount: number; currency: string }>> {
  const access = await loadAccessiblePaymentById(paymentId);
  if (!access.ok) {
    return access;
  }

  const payment = access.data;
  const featureAccess = await requireRazorpayFeatureForPayment(payment);
  if (!featureAccess.ok) {
    return featureAccess;
  }

  const eligibility = validateOnlinePaymentEligibility(payment);
  if (!eligibility.ok) {
    return eligibility;
  }

  if (payment.provider_order_id) {
    return { ok: true, data: { keyId: getRazorpayKeyId(), paymentId: payment.id, orderId: payment.provider_order_id, amount: payment.amount, currency: payment.currency } };
  }

  const admin = requireAdminClient();
  if (!admin.ok) {
    return admin;
  }

  const orderResult = await createRazorpayOrder({
    amount: payment.amount,
    currency: payment.currency,
    receipt: payment.payment_number.slice(0, 40),
    notes: compactStringRecord({
      payment_id: payment.id,
      invoice_id: payment.invoice_id,
      member_id: payment.member_id,
      gym_id: payment.gym_id
    })
  });

  if (!orderResult.ok) {
    return { ok: false, status: 503, code: "RAZORPAY_NOT_CONFIGURED", message: orderResult.message };
  }

  const order = normalizeRazorpayOrder(orderResult.order);
  if (!order) {
    return { ok: false, status: 502, code: "RAZORPAY_ORDER_INVALID", message: "Razorpay returned an invalid order response." };
  }

  const { error: updateError } = await admin.data
    .from("payments")
    .update({
      status: "processing",
      provider_order_id: order.id,
      metadata: mergeMetadata(payment.metadata, { razorpayOrderStatus: order.status ?? "created" })
    })
    .eq("id", payment.id)
    .in("status", ["pending", "processing", "failed"]);

  if (updateError) {
    return { ok: false, status: 500, code: "PAYMENT_UPDATE_FAILED", message: "Payment order could not be attached." };
  }

  await insertPaymentAttempt(admin.data, payment, {
    status: "created",
    providerOrderId: order.id,
    responsePayload: order
  });
  await insertBillingEvent(admin.data, payment.gym_id, "webhook_received", "payment", payment.id, { source: "razorpay_order_created", orderId: order.id });
  await writeAuditLog({
    actorId: context.userId,
    gymId: payment.gym_id,
    action: "payment.razorpay_order_created",
    entityType: "payment",
    entityId: payment.id,
    metadata: { orderId: order.id }
  });

  return { ok: true, data: { keyId: getRazorpayKeyId(), paymentId: payment.id, orderId: order.id, amount: payment.amount, currency: payment.currency } };
}

export async function verifyRazorpayPaymentForOrder(context: AuthContext, input: { orderId: string; paymentId: string; signature: string }): Promise<Result<{ paymentId: string; status: PaymentRow["status"] }>> {
  if (!verifyRazorpayCheckoutSignature(input)) {
    return { ok: false, status: 400, code: "INVALID_SIGNATURE", message: "Payment signature verification failed." };
  }

  const access = await loadAccessiblePaymentByOrderId(input.orderId);
  if (!access.ok) {
    return access;
  }

  const featureAccess = await requireRazorpayFeatureForPayment(access.data);
  if (!featureAccess.ok) {
    return featureAccess;
  }

  const paymentResult = await fetchRazorpayPayment(input.paymentId);
  if (!paymentResult.ok) {
    return { ok: false, status: 503, code: "RAZORPAY_NOT_CONFIGURED", message: paymentResult.message };
  }

  const razorpayPayment = normalizeRazorpayPayment(paymentResult.payment);
  if (!razorpayPayment || razorpayPayment.orderId !== input.orderId) {
    return { ok: false, status: 400, code: "PAYMENT_MISMATCH", message: "Razorpay payment details do not match this order." };
  }

  if (!razorpayPayment.captured) {
    return { ok: false, status: 409, code: "PAYMENT_NOT_CAPTURED", message: "Razorpay has not captured this payment yet." };
  }

  const validation = validateRazorpayPaymentMatch(access.data, razorpayPayment);
  if (!validation.ok) {
    return validation;
  }

  const admin = requireAdminClient();
  if (!admin.ok) {
    return admin;
  }

  const paid = await markPaymentPaid(admin.data, access.data, razorpayPayment, input.signature, context.userId);
  if (!paid.ok) {
    return paid;
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: access.data.gym_id,
    action: "payment.razorpay_verified",
    entityType: "payment",
    entityId: access.data.id,
    metadata: { providerPaymentId: razorpayPayment.id, providerOrderId: input.orderId }
  });

  return { ok: true, data: { paymentId: access.data.id, status: paid.data.status } };
}

export async function processRazorpayWebhook(rawBody: string, signature: string | null): Promise<Result<{ eventId: string; status: "processed" | "ignored" | "duplicate" }>> {
  if (!signature || !verifyRazorpayWebhookSignature({ rawBody, signature })) {
    return { ok: false, status: 400, code: "INVALID_WEBHOOK_SIGNATURE", message: "Webhook signature verification failed." };
  }

  const admin = requireAdminClient();
  if (!admin.ok) {
    return admin;
  }

  const payload = parseJsonObject(rawBody);
  if (!payload) {
    return { ok: false, status: 400, code: "INVALID_WEBHOOK_PAYLOAD", message: "Webhook payload is invalid JSON." };
  }

  const eventType = readString(payload.event) ?? "unknown";
  const eventId = readString(payload.id) ?? readString(payload.event_id) ?? `${eventType}:${signature.slice(0, 32)}`;
  const insertResult = await admin.data.from("payment_provider_events").insert({
    provider: "razorpay",
    event_id: eventId,
    event_type: eventType,
    signature,
    payload: toJson(payload)
  }).select("id").maybeSingle();

  if (insertResult.error) {
    if (insertResult.error.code === "23505") {
      return { ok: true, data: { eventId, status: "duplicate" } };
    }

    return { ok: false, status: 500, code: "WEBHOOK_EVENT_SAVE_FAILED", message: "Webhook event could not be stored." };
  }

  const processResult = await processRazorpayWebhookPayload(admin.data, payload, eventType);
  const nextStatus = processResult.ok ? processResult.data.status : "failed";

  await admin.data
    .from("payment_provider_events")
    .update({
      status: nextStatus,
      processed_at: new Date().toISOString(),
      error_message: processResult.ok ? null : processResult.message
    })
    .eq("event_id", eventId)
    .eq("provider", "razorpay");

  if (!processResult.ok) {
    return processResult;
  }

  return { ok: true, data: { eventId, status: processResult.data.status } };
}

export async function createRazorpayRefundForPayment(context: AuthContext, input: { paymentId: string; amount: number; reason: string }): Promise<Result<{ refundId: string; providerRefundId: string | null; status: RefundRow["status"] }>> {
  const access = await loadAccessiblePaymentById(input.paymentId);
  if (!access.ok) {
    return access;
  }

  const payment = access.data;
  const featureAccess = await requireRazorpayFeatureForPayment(payment);
  if (!featureAccess.ok) {
    return featureAccess;
  }

  if (payment.provider !== "razorpay" || !payment.provider_payment_id) {
    return { ok: false, status: 409, code: "PAYMENT_NOT_REFUNDABLE_ONLINE", message: "Only completed Razorpay payments can be refunded through this endpoint." };
  }

  if (payment.status !== "paid" && payment.status !== "partially_refunded") {
    return { ok: false, status: 409, code: "PAYMENT_NOT_PAID", message: "Only paid payments can be refunded." };
  }

  const admin = requireAdminClient();
  if (!admin.ok) {
    return admin;
  }

  const refunded = await getProcessedRefundTotal(admin.data, payment.id);
  const refundable = Math.max(payment.amount - refunded, 0);
  if (input.amount > refundable) {
    return { ok: false, status: 400, code: "REFUND_AMOUNT_TOO_HIGH", message: "Refund amount exceeds the remaining refundable balance." };
  }

  const refundResult = await createRazorpayRefund(payment.provider_payment_id, input.amount, {
    payment_id: payment.id,
    reason: input.reason.slice(0, 200)
  });

  if (!refundResult.ok) {
    return { ok: false, status: 503, code: "RAZORPAY_NOT_CONFIGURED", message: refundResult.message };
  }

  const providerRefund = normalizeRazorpayRefund(refundResult.refund);
  if (!providerRefund) {
    return { ok: false, status: 502, code: "RAZORPAY_REFUND_INVALID", message: "Razorpay returned an invalid refund response." };
  }

  const processedAt = new Date().toISOString();
  const status: RefundRow["status"] = providerRefund.status === "processed" ? "processed" : "processing";
  const { data: refund, error: refundError } = await admin.data.from("refunds").insert({
    gym_id: payment.gym_id,
    payment_id: payment.id,
    invoice_id: payment.invoice_id,
    member_id: payment.member_id,
    amount: input.amount,
    currency: payment.currency,
    status,
    reason: input.reason,
    provider_refund_id: providerRefund.id,
    approved_by: context.userId,
    requested_by: context.userId,
    processed_at: status === "processed" ? processedAt : null,
    metadata: toJson({ source: "razorpay_api", providerRefundStatus: providerRefund.status })
  }).select("id,status,provider_refund_id").maybeSingle();

  if (refundError || !refund) {
    return { ok: false, status: 500, code: "REFUND_SAVE_FAILED", message: "Refund record could not be saved." };
  }

  await updatePaymentRefundStatus(admin.data, payment, refunded + input.amount, context.userId, refund.id);
  await insertBillingEvent(admin.data, payment.gym_id, "refund_issued", "refund", refund.id, { paymentId: payment.id, amount: input.amount });
  await writeAuditLog({
    actorId: context.userId,
    gymId: payment.gym_id,
    action: "payment.refund_created",
    entityType: "refund",
    entityId: refund.id,
    metadata: { paymentId: payment.id, amount: input.amount }
  });

  return { ok: true, data: { refundId: refund.id, providerRefundId: refund.provider_refund_id, status: refund.status } };
}

async function loadAccessiblePaymentById(paymentId: string): Promise<Result<PaymentRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("payments").select("*").eq("id", paymentId).maybeSingle();

  if (error) {
    return { ok: false, status: 500, code: "PAYMENT_LOOKUP_FAILED", message: "Payment could not be loaded." };
  }

  if (!data) {
    return { ok: false, status: 404, code: "PAYMENT_NOT_FOUND", message: "Payment was not found or is not accessible." };
  }

  return { ok: true, data };
}

async function loadAccessiblePaymentByOrderId(orderId: string): Promise<Result<PaymentRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("payments").select("*").eq("provider_order_id", orderId).maybeSingle();

  if (error) {
    return { ok: false, status: 500, code: "PAYMENT_LOOKUP_FAILED", message: "Payment could not be loaded." };
  }

  if (!data) {
    return { ok: false, status: 404, code: "PAYMENT_NOT_FOUND", message: "Payment was not found or is not accessible." };
  }

  return { ok: true, data };
}

async function requireRazorpayFeatureForPayment(payment: PaymentRow): Promise<Result<PaymentRow>> {
  try {
    const organizationId = await getOrganizationIdForGym(payment.gym_id);
    if (!organizationId) {
      return { ok: false, status: 403, code: "FEATURE_NOT_AVAILABLE", message: "Feature not available on your current plan." };
    }

    await assertFeature(organizationId, "razorpayEnabled");
    return { ok: true, data: payment };
  } catch (error) {
    return {
      ok: false,
      status: 403,
      code: "FEATURE_NOT_AVAILABLE",
      message: error instanceof Error ? error.message : "Feature not available on your current plan."
    };
  }
}

async function getOrganizationIdForGym(gymId: string | null) {
  if (!gymId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("gyms").select("organization_id").eq("id", gymId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  return data?.organization_id ?? null;
}

function validateOnlinePaymentEligibility(payment: PaymentRow): Result<PaymentRow> {
  if (payment.provider !== "razorpay" || payment.method !== "razorpay") {
    return { ok: false, status: 409, code: "NOT_RAZORPAY_PAYMENT", message: "This payment is not configured for Razorpay collection." };
  }

  if (payment.status === "paid" || payment.status === "refunded" || payment.status === "partially_refunded") {
    return { ok: false, status: 409, code: "PAYMENT_ALREADY_FINALIZED", message: "This payment is already finalized." };
  }

  if (payment.amount <= 0) {
    return { ok: false, status: 400, code: "INVALID_PAYMENT_AMOUNT", message: "Payment amount must be greater than zero." };
  }

  return { ok: true, data: payment };
}

function validateRazorpayPaymentMatch(payment: PaymentRow, razorpayPayment: RazorpayPaymentEntity): Result<PaymentRow> {
  if (payment.provider_order_id !== razorpayPayment.orderId) {
    return { ok: false, status: 400, code: "ORDER_MISMATCH", message: "Razorpay order does not match this payment." };
  }

  if (payment.amount !== razorpayPayment.amount || payment.currency.toUpperCase() !== razorpayPayment.currency.toUpperCase()) {
    return { ok: false, status: 400, code: "AMOUNT_MISMATCH", message: "Razorpay amount or currency does not match this payment." };
  }

  if (payment.status === "paid" && payment.provider_payment_id === razorpayPayment.id) {
    return { ok: true, data: payment };
  }

  if (payment.status === "paid") {
    return { ok: false, status: 409, code: "PAYMENT_ALREADY_PAID", message: "This payment was already completed with a different provider payment." };
  }

  return { ok: true, data: payment };
}

async function markPaymentPaid(admin: AppSupabase, payment: PaymentRow, razorpayPayment: RazorpayPaymentEntity, signature: string | null, actorId: string | null): Promise<Result<{ status: PaymentRow["status"] }>> {
  if (payment.status === "paid" && payment.provider_payment_id === razorpayPayment.id) {
    return { ok: true, data: { status: "paid" } };
  }

  const paidAt = new Date().toISOString();
  const { data: updatedPayment, error: paymentError } = await admin
    .from("payments")
    .update({
      status: "paid",
      provider_payment_id: razorpayPayment.id,
      provider_signature: signature,
      paid_at: paidAt,
      collected_at: paidAt,
      failed_at: null,
      failure_reason: null,
      metadata: mergeMetadata(payment.metadata, {
        razorpayPaymentStatus: razorpayPayment.status,
        razorpayMethod: razorpayPayment.method
      })
    })
    .eq("id", payment.id)
    .in("status", ["pending", "processing", "failed"])
    .select("*")
    .maybeSingle();

  if (paymentError) {
    return { ok: false, status: 500, code: "PAYMENT_CAPTURE_SAVE_FAILED", message: "Payment capture could not be saved." };
  }

  if (!updatedPayment) {
    const { data: currentPayment } = await admin.from("payments").select("*").eq("id", payment.id).maybeSingle();

    if (currentPayment?.status === "paid" && currentPayment.provider_payment_id === razorpayPayment.id) {
      return { ok: true, data: { status: "paid" } };
    }

    return { ok: false, status: 409, code: "PAYMENT_ALREADY_FINALIZED", message: "Payment was already finalized and cannot be captured again." };
  }

  if (updatedPayment.invoice_id) {
    await updateInvoicePaidAmount(admin, updatedPayment.invoice_id, updatedPayment.amount, paidAt);
  }

  await insertPaymentAttempt(admin, updatedPayment, {
    status: "verified",
    providerOrderId: razorpayPayment.orderId,
    providerPaymentId: razorpayPayment.id,
    responsePayload: razorpayPayment
  });
  await insertTransactionOnce(admin, updatedPayment, actorId, "payment_collected", "credit", updatedPayment.amount, "Payment collected through Razorpay", { providerPaymentId: razorpayPayment.id });
  await insertBillingEvent(admin, updatedPayment.gym_id, "payment_completed", "payment", updatedPayment.id, { providerPaymentId: razorpayPayment.id });

  return { ok: true, data: { status: "paid" } };
}

async function processRazorpayWebhookPayload(admin: AppSupabase, payload: Record<string, unknown>, eventType: string): Promise<Result<{ status: "processed" | "ignored" }>> {
  const paymentEntity = normalizeRazorpayPayment(readNestedObject(payload, ["payload", "payment", "entity"]));

  if ((eventType === "payment.captured" || eventType === "payment.authorized") && paymentEntity?.captured) {
    const payment = await loadPaymentForWebhook(admin, paymentEntity);
    if (!payment) {
      const subResult = await processSubscriptionWebhookPayment(paymentEntity, payload);
      if (subResult.processed) {
        return { ok: true, data: { status: "processed" } };
      }
      return { ok: true, data: { status: "ignored" } };
    }

    const validation = validateRazorpayPaymentMatch(payment, paymentEntity);
    if (!validation.ok) {
      return validation;
    }

    const result = await markPaymentPaid(admin, payment, paymentEntity, null, null);
    return result.ok ? { ok: true, data: { status: "processed" } } : result;
  }

  if (eventType === "payment.failed" && paymentEntity) {
    const payment = await loadPaymentForWebhook(admin, paymentEntity);
    if (!payment || payment.status === "paid") {
      return { ok: true, data: { status: "ignored" } };
    }

    await admin.from("payments").update({
      status: "failed",
      provider_payment_id: paymentEntity.id,
      failed_at: new Date().toISOString(),
      failure_reason: paymentEntity.errorDescription ?? paymentEntity.errorCode ?? "Razorpay payment failed.",
      metadata: mergeMetadata(payment.metadata, { razorpayPaymentStatus: paymentEntity.status })
    }).eq("id", payment.id);
    await insertPaymentAttempt(admin, payment, {
      status: "failed",
      providerOrderId: paymentEntity.orderId,
      providerPaymentId: paymentEntity.id,
      errorCode: paymentEntity.errorCode,
      errorDescription: paymentEntity.errorDescription,
      responsePayload: paymentEntity
    });
    await insertBillingEvent(admin, payment.gym_id, "payment_failed", "payment", payment.id, { providerPaymentId: paymentEntity.id });
    return { ok: true, data: { status: "processed" } };
  }

  const refundEntity = normalizeRazorpayRefund(readNestedObject(payload, ["payload", "refund", "entity"]));
  if (eventType.startsWith("refund.") && refundEntity) {
    await admin.from("refunds").update({
      status: refundEntity.status === "processed" ? "processed" : "processing",
      processed_at: refundEntity.status === "processed" ? new Date().toISOString() : null,
      metadata: toJson({ source: "razorpay_webhook", providerRefundStatus: refundEntity.status })
    }).eq("provider_refund_id", refundEntity.id);
    return { ok: true, data: { status: "processed" } };
  }

  return { ok: true, data: { status: "ignored" } };
}

async function processSubscriptionWebhookPayment(
  paymentEntity: RazorpayPaymentEntity,
  payload: Record<string, unknown>,
): Promise<{ processed: boolean }> {
  if (!paymentEntity.orderId) return { processed: false };

  const orderEntity = asObject(readNestedObject(payload, ["payload", "order", "entity"]));
  const notes = asObject(orderEntity?.notes);
  const orgInvoiceId = readString(notes?.invoice_id);
  if (!orgInvoiceId) return { processed: false };

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { processed: false };

  const db = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(c: string, v: string): {
          maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          order(c: string, o: { ascending: boolean }): { limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> };
        };
      };
      insert(r: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
      update(r: Record<string, unknown>): {
        eq(c: string, v: string): Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { data: invoice } = await db.from("org_subscription_invoices").select("*").eq("id", orgInvoiceId).maybeSingle();
  if (!invoice) return { processed: false };
  if (invoice.status === "paid") return { processed: true };

  const now = new Date().toISOString();
  const paymentNumber = `SUB-PAY-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const { data: existingInvoice } = await db.from("org_subscription_invoices").select("*").eq("id", orgInvoiceId).single();
  if (!existingInvoice) return { processed: false };
  const currentAmountPaid = (existingInvoice.amount_paid as number) || 0;
  const totalAmount = (existingInvoice.total_amount as number) || (existingInvoice.subtotal_amount as number) || 0;
  const newAmountPaid = currentAmountPaid + paymentEntity.amount;
  const newStatus = newAmountPaid >= totalAmount ? "paid" : "partially_paid";

  await db.from("org_subscription_invoices").update({
    status: newStatus,
    amount_paid: newAmountPaid,
    razorpay_payment_id: paymentEntity.id,
    paid_at: newStatus === "paid" ? now : (existingInvoice.paid_at as string | null) ?? null,
  }).eq("id", orgInvoiceId);

  const orgId = invoice.organization_id as string;
  const subId = invoice.subscription_id as string;

  await db.from("org_subscription_payments").insert({
    organization_id: orgId,
    subscription_id: subId,
    invoice_id: orgInvoiceId,
    payment_number: paymentNumber,
    status: "paid",
    provider: "razorpay",
    amount: paymentEntity.amount,
    currency: paymentEntity.currency || "INR",
    provider_order_id: paymentEntity.orderId,
    provider_payment_id: paymentEntity.id,
    paid_at: now,
  });

  if (newStatus === "paid") {
    await db.from("organization_subscriptions").update({
      last_billing_date: now,
    }).eq("id", subId);
  }

  try {
    await recordSubscriptionEvent({
      organizationId: orgId,
      subscriptionId: subId,
      eventType: "payment_recovered",
      newState: { invoiceId: orgInvoiceId, razorpayPaymentId: paymentEntity.id, amount: paymentEntity.amount, status: newStatus },
      reason: `Subscription invoice ${orgInvoiceId} paid via Razorpay webhook (order: ${paymentEntity.orderId})`,
      metadata: { providerPaymentId: paymentEntity.id, providerOrderId: paymentEntity.orderId },
    });
  } catch {
    // non-critical; don't fail the webhook for event recording failure
  }

  return { processed: true };
}

async function loadPaymentForWebhook(admin: AppSupabase, razorpayPayment: RazorpayPaymentEntity) {
  if (razorpayPayment.orderId) {
    const { data } = await admin.from("payments").select("*").eq("provider_order_id", razorpayPayment.orderId).maybeSingle();
    if (data) {
      return data;
    }
  }

  const { data } = await admin.from("payments").select("*").eq("provider_payment_id", razorpayPayment.id).maybeSingle();
  return data;
}

async function updateInvoicePaidAmount(admin: AppSupabase, invoiceId: string, paymentAmount: number, paidAt: string) {
  const { data: invoice } = await admin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) {
    return;
  }

  const nextPaid = Math.min(invoice.total_amount, invoice.amount_paid + paymentAmount);
  const status: InvoiceRow["status"] = nextPaid >= invoice.total_amount ? "paid" : "partially_paid";
  await admin.from("invoices").update({
    amount_paid: nextPaid,
    status,
    paid_at: status === "paid" ? paidAt : invoice.paid_at
  }).eq("id", invoice.id);
}

async function updatePaymentRefundStatus(admin: AppSupabase, payment: PaymentRow, refundedTotal: number, actorId: string | null, refundId: string) {
  const status: PaymentRow["status"] = refundedTotal >= payment.amount ? "refunded" : "partially_refunded";
  await admin.from("payments").update({ status }).eq("id", payment.id);
  await insertTransactionOnce(admin, payment, actorId, "refund_processed", "debit", refundedTotal, "Refund processed through Razorpay", { refundId });
}

async function getProcessedRefundTotal(admin: AppSupabase, paymentId: string) {
  const { data } = await admin.from("refunds").select("amount,status").eq("payment_id", paymentId).in("status", ["processed", "processing"]);
  return (data ?? []).reduce((total, refund) => total + refund.amount, 0);
}

async function insertPaymentAttempt(
  admin: AppSupabase,
  payment: PaymentRow,
  input: {
    status: PaymentAttemptStatus;
    providerOrderId?: string | null;
    providerPaymentId?: string | null;
    requestPayload?: unknown;
    responsePayload?: unknown;
    errorCode?: string | null;
    errorDescription?: string | null;
  }
) {
  await admin.from("payment_attempts").insert({
    gym_id: payment.gym_id,
    payment_id: payment.id,
    invoice_id: payment.invoice_id,
    provider: "razorpay",
    provider_order_id: input.providerOrderId ?? payment.provider_order_id,
    provider_payment_id: input.providerPaymentId ?? payment.provider_payment_id,
    status: input.status,
    amount: payment.amount,
    request_payload: toJson(input.requestPayload ?? {}),
    response_payload: toJson(input.responsePayload ?? {}),
    error_code: input.errorCode ?? null,
    error_description: input.errorDescription ?? null
  });
}

async function insertTransactionOnce(admin: AppSupabase, payment: PaymentRow, actorId: string | null, transactionType: TransactionType, direction: TransactionDirection, amount: number, description: string, metadata: Record<string, Json>) {
  const { data: existing } = await admin
    .from("transactions")
    .select("id")
    .eq("payment_id", payment.id)
    .eq("transaction_type", transactionType)
    .maybeSingle();

  if (existing) {
    return;
  }

  const { error } = await admin.from("transactions").insert({
    gym_id: payment.gym_id,
    member_id: payment.member_id,
    invoice_id: payment.invoice_id,
    payment_id: payment.id,
    transaction_type: transactionType,
    direction,
    amount,
    currency: payment.currency,
    description,
    metadata,
    created_by: actorId
  });

  if (error && error.code !== "23505") {
    billingLogger.error("insertTransactionOnce", "Payment transaction insert failed", { paymentId: payment.id, transactionType, message: error.message });
  }
}

async function insertBillingEvent(admin: AppSupabase, gymId: string | null, eventType: BillingEventType, entityType: string, entityId: string | null, metadata: Record<string, Json>) {
  await admin.from("billing_events").insert({
    gym_id: gymId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    status: "recorded",
    metadata
  });
}

function requireAdminClient(): Result<AppSupabase> {
  const client = getSupabaseAdminClient();

  if (!client) {
    return { ok: false, status: 503, code: "SUPABASE_ADMIN_NOT_CONFIGURED", message: "Supabase service role is required for financial processing." };
  }

  return { ok: true, data: client };
}

function normalizeRazorpayOrder(value: unknown): RazorpayOrderEntity | null {
  const object = asObject(value);
  const id = readString(object?.id);
  const amount = readNumber(object?.amount);
  const currency = readString(object?.currency);

  if (!id || amount === null || !currency) {
    return null;
  }

  return { id, amount, currency, status: readString(object?.status) };
}

function normalizeRazorpayPayment(value: unknown): RazorpayPaymentEntity | null {
  const object = asObject(value);
  const id = readString(object?.id);
  const amount = readNumber(object?.amount);
  const currency = readString(object?.currency);

  if (!id || amount === null || !currency) {
    return null;
  }

  const status = readString(object?.status);
  const capturedValue = object?.captured;
  const captured = capturedValue === true || status === "captured";

  return {
    id,
    orderId: readString(object?.order_id),
    amount,
    currency,
    status,
    captured,
    method: readString(object?.method),
    errorCode: readString(object?.error_code),
    errorDescription: readString(object?.error_description)
  };
}

function normalizeRazorpayRefund(value: unknown): RazorpayRefundEntity | null {
  const object = asObject(value);
  const id = readString(object?.id);
  const amount = readNumber(object?.amount);

  if (!id || amount === null) {
    return null;
  }

  return {
    id,
    paymentId: readString(object?.payment_id),
    amount,
    currency: readString(object?.currency),
    status: readString(object?.status)
  };
}

function parseJsonObject(value: string) {
  try {
    return asObject(JSON.parse(value));
  } catch {
    return null;
  }
}

function readNestedObject(value: Record<string, unknown>, path: string[]) {
  return path.reduce<unknown>((current, key) => asObject(current)?.[key], value);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compactStringRecord(input: Record<string, string | null>) {
  return Object.fromEntries(Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0));
}

function mergeMetadata(current: Json, patch: Record<string, Json>): Json {
  const base = current && typeof current === "object" && !Array.isArray(current) ? current as Record<string, Json> : {};
  return { ...base, ...patch };
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
