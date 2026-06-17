import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const BILLING_DAYS: Record<string, number> = { monthly: 30, annual: 365 };

export type FinalizePaymentResult = {
  success: boolean;
  paymentId?: string;
  invoiceId?: string;
  subscriptionId?: string;
  warning?: string;
  error?: string;
};

/**
 * Shared helper for finalizing a successful subscription payment.
 * Used by both Phase 6 frontend verification and Phase 7 webhook processing.
 * Idempotent: safe to call multiple times for the same payment.
 */
export async function finalizeSuccessfulSubscriptionPayment(params: {
  organizationId: string;
  packageId: string;
  invoiceId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  billingCycle: string;
  subscriptionId?: string | null | undefined;
  actorId?: string | null;
}): Promise<FinalizePaymentResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = getSupabaseAdminClient() as any;
  if (!adminDb) return { success: false, error: "Database connection failed." };

  const { organizationId, packageId, invoiceId, razorpayOrderId, razorpayPaymentId, billingCycle, subscriptionId, actorId } = params;

  // 1. Get invoice
  const { data: invoice } = await adminDb.from("org_subscription_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) return { success: false, error: "Invoice not found." };
  if (invoice.organization_id !== organizationId) return { success: false, error: "Invoice mismatch." };
  if (invoice.status === "paid") return { success: true, invoiceId, warning: "Already paid." };

  // 2. Create or update payment record
  const { data: existingPmts } = await adminDb.from("org_subscription_payments").select("id, status").eq("provider_payment_id", razorpayPaymentId);
  const existingPmt = (existingPmts ?? [])[0];
  let paymentDbId: string | undefined;

  if (existingPmt) {
    paymentDbId = existingPmt.id;
    if (existingPmt.status !== "paid") {
      await adminDb.from("org_subscription_payments").update({ status: "paid", provider_signature_verified: true, paid_at: new Date().toISOString() }).eq("id", existingPmt.id);
    }
  } else {
    const { data: np } = await adminDb.from("org_subscription_payments").insert({
      organization_id: organizationId, subscription_id: subscriptionId || null, invoice_id: invoiceId,
      payment_number: `PAY-${organizationId.slice(0, 8)}-${String(Date.now()).slice(-6)}`,
      status: "paid", provider: "razorpay", provider_environment: "test",
      provider_order_id: razorpayOrderId, provider_payment_id: razorpayPaymentId,
      provider_signature_verified: true,
      amount: invoice.total_amount || invoice.subtotal_amount || 0,
      currency: invoice.currency || "INR",
      paid_at: new Date().toISOString(),
    }).select("id").maybeSingle();
    paymentDbId = np?.id;
  }

  // 3. Update invoice
  await adminDb.from("org_subscription_invoices").update({
    status: "paid", razorpay_payment_id: razorpayPaymentId, paid_at: new Date().toISOString(),
  }).eq("id", invoiceId);

  // 4. Activate/renew subscription
  const days = BILLING_DAYS[billingCycle] || 30;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + days * 86400000).toISOString();
  const nextBilling = periodEnd;

  let subId = subscriptionId;
  if (subId) {
    const { data: existingSub } = await adminDb.from("organization_subscriptions").select("id, status, trial_ends_at").eq("id", subId).maybeSingle();
    if (existingSub) {
      await adminDb.from("organization_subscriptions").update({
        package_id: packageId, status: "active", billing_period: billingCycle,
        trial_ends_at: existingSub.trial_ends_at ? now.toISOString() : undefined,
        started_at: now.toISOString(), expires_at: periodEnd, next_billing_date: nextBilling,
        latest_invoice_id: invoiceId, latest_payment_id: paymentDbId || null, updated_at: now.toISOString(),
      }).eq("id", subId);

      if (existingSub.status === "trial") {
        await adminDb.from("subscription_events").insert({
          organization_id: organizationId, subscription_id: subId, event_type: "trial_converted",
          actor_id: actorId, new_state: { packageId, billingCycle, invoiceId },
          reason: "Trial converted to paid", created_at: now.toISOString(),
        });
      }
    } else {
      subId = undefined;
    }
  }

  if (!subId) {
    const { data: ns } = await adminDb.from("organization_subscriptions").insert({
      organization_id: organizationId, package_id: packageId, status: "active",
      billing_period: billingCycle, started_at: now.toISOString(), expires_at: periodEnd,
      next_billing_date: nextBilling, latest_invoice_id: invoiceId, latest_payment_id: paymentDbId || null,
      provider: "razorpay", provider_environment: "test", auto_renew: true,
    }).select("id").maybeSingle();
    subId = ns?.id;
  }

  // 5. Sync entitlements
  try {
    const { syncEntitlementsAction, syncUsageLimitsAction } = await import("@/features/subscription/super-admin-actions");
    const [eRes, lRes] = await Promise.all([syncEntitlementsAction(organizationId), syncUsageLimitsAction(organizationId)]);
    if (!eRes.ok || !lRes.ok) {
      await adminDb.from("subscription_events").insert({
        organization_id: organizationId, subscription_id: subId || null, event_type: "entitlement_sync_failed",
        actor_id: actorId, new_state: {}, reason: "Entitlement sync failed after payment", created_at: now.toISOString(),
      });
    } else {
      await adminDb.from("subscription_events").insert({
        organization_id: organizationId, subscription_id: subId || null, event_type: "entitlement_sync_completed",
        actor_id: actorId, new_state: {}, reason: "Entitlement synced after payment", created_at: now.toISOString(),
      });
    }
  } catch {
    // silent
  }

  // 6. Record audit event
  await adminDb.from("subscription_events").insert({
    organization_id: organizationId, subscription_id: subId || null, event_type: "payment_verified",
    actor_id: actorId, new_state: { razorpayOrderId, razorpayPaymentId, invoiceId },
    reason: `Payment ${razorpayPaymentId} finalized`, created_at: now.toISOString(),
  });

  const result: FinalizePaymentResult = { success: true, invoiceId };
  if (paymentDbId) result.paymentId = paymentDbId;
  if (subId) result.subscriptionId = subId;
  return result;
}
