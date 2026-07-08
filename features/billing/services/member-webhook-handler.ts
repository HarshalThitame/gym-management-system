import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";
import { sendPaymentReceipt } from "@/features/billing/services/receipt-service";

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

    // Record coupon usage if a promo code was applied to this invoice
    const { data: paidInvoice } = await admin
      .from("invoices")
      .select("notes")
      .eq("id", payment.invoice_id)
      .maybeSingle() as never as {
      data: { notes: string | null } | null;
      error: unknown;
    };

    if (paidInvoice?.notes) {
      const couponMatch = paidInvoice.notes.match(/\[COUPON:([^\]]+):([^\]]+):(\d+)\]/);
      if (couponMatch) {
        const { recordCouponUsage } = await import("@/features/billing/services/coupon-redemption-service");
        await recordCouponUsage(couponMatch[1], payment.member_id, payment.invoice_id);
      }
    }

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

  sendPaymentReceipt({
    paymentId: payment.id,
    invoiceId: payment.invoice_id ?? "",
    memberId: payment.member_id,
    amount: payment.amount,
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

export async function handleSubscriptionCharged(
  razorpaySubscriptionId: string,
  razorpayPaymentId: string,
  razorpayOrderId: string,
): Promise<MemberPaymentResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { handled: false, error: "Supabase admin client not configured" };

  const { data: subscription } = await admin
    .from("member_subscriptions")
    .select("*, memberships!inner(*)")
    .eq("provider_subscription_id", razorpaySubscriptionId)
    .maybeSingle() as never as {
    data: {
      id: string;
      member_id: string;
      membership_id: string;
      gym_id: string;
      amount: number;
      currency: string;
      provider: string;
      next_charge_at: string | null;
      current_period_end: string | null;
      memberships: { status: string; end_date: string; membership_plan_id: string };
    } | null;
    error: { message: string } | null;
  };

  if (!subscription) return { handled: false, error: "No matching subscription found" };

  const now = new Date().toISOString();

  const invoiceNumber = `SUB-INV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
  const { data: invoice } = await admin.from("invoices").insert({
    gym_id: subscription.gym_id,
    member_id: subscription.member_id,
    membership_id: subscription.membership_id,
    invoice_number: invoiceNumber,
    status: "paid",
    subtotal_amount: subscription.amount,
    total_amount: subscription.amount,
    amount_paid: subscription.amount,
    issued_at: now,
    paid_at: now,
    due_at: now,
  } as never).select("id").maybeSingle() as never as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (!invoice) return { handled: false, error: "Failed to create invoice" };

  const paymentNumber = `SUB-PAY-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
  const { data: payment } = await admin.from("payments").insert({
    gym_id: subscription.gym_id,
    member_id: subscription.member_id,
    membership_id: subscription.membership_id,
    invoice_id: invoice.id,
    payment_number: paymentNumber,
    payment_type: "membership_renewal",
    status: "paid",
    method: "razorpay",
    provider: "razorpay",
    amount: subscription.amount,
    currency: subscription.currency,
    provider_order_id: razorpayOrderId,
    provider_payment_id: razorpayPaymentId,
    paid_at: now,
    collected_at: now,
    metadata: { autoRenewal: true, subscriptionId: subscription.id, source: "subscription_charged" },
  } as never).select("id").maybeSingle() as never as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (!payment) return { handled: false, error: "Failed to create payment" };

  await admin.from("member_subscriptions").update({
    last_charged_at: now,
    current_period_end: subscription.current_period_end,
    failure_count: 0,
    last_failure_reason: null,
  } as never).eq("id", subscription.id);

  const planId = subscription.memberships.membership_plan_id;
  const { data: plan } = planId
    ? await admin.from("membership_plans").select("duration_days, name").eq("id", planId).maybeSingle() as never as {
        data: { duration_days: number; name: string } | null;
        error: unknown;
      }
    : { data: null };

  if (plan) {
    const currentEnd = new Date(subscription.memberships.end_date);
    const newEnd = new Date(currentEnd);
    newEnd.setDate(newEnd.getDate() + plan.duration_days);

    await admin.from("memberships").update({
      status: "active",
      end_date: newEnd.toISOString().slice(0, 10),
      payment_status: "paid",
    } as never).eq("id", subscription.membership_id);

    await admin.from("member_subscriptions").update({
      next_charge_at: newEnd.toISOString(),
    } as never).eq("id", subscription.id);

    await admin.from("billing_events").insert({
      gym_id: subscription.gym_id,
      event_type: "membership_renewed",
      entity_type: "membership",
      entity_id: subscription.membership_id,
      status: "recorded",
      metadata: { subscriptionId: subscription.id, planName: plan.name, source: "subscription_charged" },
    } as never);
  }

  billingLogger.info("handleSubscriptionCharged", "Subscription charge processed", {
    subscriptionId: subscription.id,
    membershipId: subscription.membership_id,
    paymentId: payment.id,
    invoiceId: invoice.id,
  });

  sendPaymentReceipt({
    paymentId: payment.id,
    invoiceId: invoice.id,
    memberId: subscription.member_id,
    amount: subscription.amount,
    razorpayPaymentId,
    provider: "Razorpay",
  });

  return { handled: true };
}

export async function handleSubscriptionChargeFailed(
  razorpaySubscriptionId: string,
  failureReason: string,
): Promise<MemberPaymentResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { handled: false, error: "Supabase admin client not configured" };

  const { data: subscription } = await admin
    .from("member_subscriptions")
    .select("id, member_id, membership_id, failure_count")
    .eq("provider_subscription_id", razorpaySubscriptionId)
    .maybeSingle() as never as {
    data: { id: string; member_id: string; membership_id: string; failure_count: number } | null;
    error: { message: string } | null;
  };

  if (!subscription) return { handled: false, error: "No matching subscription found" };

  const newFailureCount = (subscription.failure_count ?? 0) + 1;

  await admin.from("member_subscriptions").update({
    failure_count: newFailureCount,
    last_failure_reason: failureReason,
    status: newFailureCount >= 3 ? "failed" : "active",
  } as never).eq("id", subscription.id);

  await admin.from("billing_events").insert({
    gym_id: null,
    event_type: "subscription_charge_failed",
    entity_type: "subscription",
    entity_id: subscription.id,
    status: "recorded",
    metadata: { failureCount: newFailureCount, failureReason, membershipId: subscription.membership_id },
  } as never);

  if (newFailureCount >= 3) {
    await admin.from("memberships").update({
      status: "suspended",
    } as never).eq("id", subscription.membership_id);
  }

  billingLogger.warn("handleSubscriptionChargeFailed", "Subscription charge failed", {
    subscriptionId: subscription.id,
    failureCount: newFailureCount,
    failureReason,
  });

  return { handled: true };
}
