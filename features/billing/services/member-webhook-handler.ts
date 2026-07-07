import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";

type MemberPaymentResult = {
  handled: boolean;
  error?: string;
};

type MemberPaymentRow = {
  id: string;
  invoice_id: string | null;
  member_id: string;
  membership_id: string | null;
  status: string;
  amount: number;
  metadata: Record<string, unknown> | null;
};

type MemberInvoiceRow = {
  id: string;
  status: string;
  membership_id: string | null;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
};

type MemberRow = {
  id: string;
  gym_id: string | null;
  full_name: string;
  email: string | null;
};

type MembershipRow = {
  id: string;
  member_id: string;
  membership_plan_id: string;
  status: string;
  end_date: string;
};

type PlanRow = {
  id: string;
  duration_days: number;
  name: string;
};

export async function handleMemberPaymentCaptured(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<MemberPaymentResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { handled: false, error: "Supabase admin client not configured" };

  const { data: payment } = await admin
    .from("payments")
    .select("id, invoice_id, member_id, membership_id, status, amount, metadata")
    .eq("provider_order_id", razorpayOrderId)
    .maybeSingle() as never as {
    data: MemberPaymentRow | null;
    error: { message: string } | null;
  };

  if (!payment) return { handled: false, error: "No matching member payment found" };

  if (payment.status === "paid") {
    billingLogger.info("handleMemberPaymentCaptured", "Payment already processed", { paymentId: payment.id });
    return { handled: true };
  }

  const now = new Date().toISOString();

  await admin.from("payments").update({
    status: "paid",
    provider_payment_id: razorpayPaymentId,
    paid_at: now,
  } as never).eq("id", payment.id);

  if (payment.invoice_id) {
    await admin.from("invoices").update({
      status: "paid",
      amount_paid: payment.amount,
      paid_at: now,
      razorpay_payment_id: razorpayPaymentId,
    } as never).eq("id", payment.invoice_id);

    await admin.from("billing_events").insert({
      gym_id: null,
      event_type: "payment_completed",
      entity_type: "invoice",
      entity_id: payment.invoice_id,
      status: "recorded",
      metadata: { paymentId: payment.id, providerPaymentId: razorpayPaymentId, source: "webhook" },
    } as never);

    await admin.from("transactions").insert({
      gym_id: null,
      member_id: payment.member_id,
      invoice_id: payment.invoice_id,
      payment_id: payment.id,
      transaction_type: "payment_collected",
      direction: "credit",
      amount: payment.amount,
      currency: "INR",
      description: `Online payment collected via Razorpay (${razorpayPaymentId})`,
      metadata: { providerPaymentId: razorpayPaymentId, source: "webhook" },
    } as never);
  }

  if (payment.membership_id) {
    const { data: membership } = await admin
      .from("memberships")
      .select("id, member_id, membership_plan_id, status, end_date")
      .eq("id", payment.membership_id)
      .maybeSingle() as never as {
      data: MembershipRow | null;
      error: { message: string } | null;
    };

    if (membership) {
      const { data: plan } = await admin
        .from("membership_plans")
        .select("id, duration_days, name")
        .eq("id", membership.membership_plan_id)
        .maybeSingle() as never as {
        data: PlanRow | null;
        error: { message: string } | null;
      };

      if (plan) {
        const currentEnd = new Date(membership.end_date);
        const newEnd = new Date(currentEnd);
        newEnd.setDate(newEnd.getDate() + plan.duration_days);

        await admin.from("memberships").update({
          status: "active",
          end_date: newEnd.toISOString().slice(0, 10),
          payment_status: "paid",
        } as never).eq("id", membership.id);

        await admin.from("billing_events").insert({
          gym_id: null,
          event_type: "membership_renewed",
          entity_type: "membership",
          entity_id: membership.id,
          status: "recorded",
          metadata: {
            paymentId: payment.id,
            invoiceId: payment.invoice_id,
            planName: plan.name,
            newEndDate: newEnd.toISOString().slice(0, 10),
          },
        } as never);
      }
    }
  }

  billingLogger.info("handleMemberPaymentCaptured", "Member payment processed", {
    paymentId: payment.id,
    invoiceId: payment.invoice_id,
    membershipId: payment.membership_id,
    razorpayPaymentId,
  });

  return { handled: true };
}

export async function handleMemberPaymentFailed(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  failureReason: string,
): Promise<MemberPaymentResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { handled: false, error: "Supabase admin client not configured" };

  const { data: payment } = await admin
    .from("payments")
    .select("id, invoice_id, member_id, membership_id, status, amount, metadata")
    .or(`provider_order_id.eq.${razorpayOrderId},provider_payment_id.eq.${razorpayPaymentId}`)
    .limit(1)
    .maybeSingle() as never as {
    data: MemberPaymentRow | null;
    error: { message: string } | null;
  };

  if (!payment) return { handled: false, error: "No matching member payment found" };

  await admin.from("payments").update({
    status: "failed",
    failure_reason: failureReason,
    failed_at: new Date().toISOString(),
  } as never).eq("id", payment.id);

  if (payment.invoice_id) {
    const now = new Date();
    const graceEnd = new Date(now);
    graceEnd.setDate(graceEnd.getDate() + 3);
    const nextRetry = new Date(now);
    nextRetry.setDate(nextRetry.getDate() + 3);

    await admin.from("invoices").update({
      dunning_status: "payment_failed",
      dunning_attempts: 1,
      dunning_last_attempt_at: now.toISOString(),
      dunning_last_failure_reason: failureReason,
      dunning_next_retry_at: nextRetry.toISOString(),
      dunning_grace_period_ends_at: graceEnd.toISOString(),
    } as never).eq("id", payment.invoice_id);

    await admin.from("billing_events").insert({
      gym_id: null,
      event_type: "payment_failed",
      entity_type: "payment",
      entity_id: payment.id,
      status: "recorded",
      metadata: {
        invoiceId: payment.invoice_id,
        failureReason,
        razorpayPaymentId,
        nextRetryAt: nextRetry.toISOString(),
      },
    } as never);
  }

  billingLogger.info("handleMemberPaymentFailed", "Member payment failed", {
    paymentId: payment.id,
    invoiceId: payment.invoice_id,
    razorpayPaymentId,
    failureReason,
  });

  return { handled: true };
}
