import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FinalizePaymentInput, FinalizePaymentResult } from "@/features/billing/razorpay/razorpay-types";

const BILLING_DAYS: Record<string, number> = { monthly: 30, annual: 365 };

export async function finalizeSubscriptionPayment(
  input: FinalizePaymentInput,
): Promise<FinalizePaymentResult> {
  const { providerOrderId, providerPaymentId, providerEnvironment, eventId } = input;

  const adminDb = getSupabaseAdminClient();
  if (!adminDb) {
    return { success: false, error: "Database connection failed.", code: "DB_CONNECTION_FAILED" };
  }
  const d = adminDb as any;

  const { data: existingEvents } = await d
    .from("payment_provider_events")
    .select("id, status")
    .eq("event_id", eventId);

  const existingEvent = (existingEvents ?? [])[0];
  if (existingEvent && existingEvent.status === "processed") {
    const { data: alreadyFinalizedInvoice } = await d
      .from("org_subscription_invoices")
      .select("id, status")
      .eq("razorpay_order_id", providerOrderId)
      .maybeSingle();

    if (alreadyFinalizedInvoice && alreadyFinalizedInvoice.status === "paid") {
      return {
        success: true,
        invoiceId: alreadyFinalizedInvoice.id,
        paymentId: "",
        subscriptionId: "",
        wasAlreadyFinalized: true,
        entitlementSyncStatus: "skipped",
      };
    }
  }

  const { data: payments } = await d
    .from("org_subscription_payments")
    .select("id, invoice_id, organization_id, subscription_id, status, amount, currency")
    .eq("provider_order_id", providerOrderId);

  const paymentRecord = (payments ?? [])[0];

  if (!paymentRecord) {
    return { success: false, error: "No matching payment record found for this order.", code: "PAYMENT_NOT_FOUND" };
  }

  if (paymentRecord.status === "paid") {
    const { data: paidInvoice } = await d
      .from("org_subscription_invoices")
      .select("id, subscription_id")
      .eq("id", paymentRecord.invoice_id)
      .maybeSingle();

    return {
      success: true,
      invoiceId: paidInvoice?.id || paymentRecord.invoice_id,
      paymentId: paymentRecord.id,
      subscriptionId: paidInvoice?.subscription_id || paymentRecord.subscription_id || "",
      wasAlreadyFinalized: true,
      entitlementSyncStatus: "skipped",
    };
  }

  const organizationId = paymentRecord.organization_id;
  const invoiceId = paymentRecord.invoice_id;
  const paymentDbId = paymentRecord.id;
  const currency = paymentRecord.currency;

  const { data: invoice } = await d
    .from("org_subscription_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) {
    return { success: false, error: "Invoice not found.", code: "INVOICE_NOT_FOUND" };
  }

  if (invoice.organization_id !== organizationId) {
    return { success: false, error: "Organization mismatch between payment and invoice.", code: "ORG_MISMATCH" };
  }

  if (invoice.status === "paid") {
    return {
      success: true,
      invoiceId,
      paymentId: paymentDbId,
      subscriptionId: invoice.subscription_id || paymentRecord.subscription_id || "",
      wasAlreadyFinalized: true,
      entitlementSyncStatus: "skipped",
    };
  }

  if (invoice.currency !== currency) {
    return { success: false, error: "Currency mismatch between payment and invoice.", code: "CURRENCY_MISMATCH" };
  }

  const invoiceTotal = invoice.total_amount || invoice.subtotal_amount || 0;
  const paymentAmount = paymentRecord.amount;

  if (Math.abs(invoiceTotal - paymentAmount) > 1) {
    return { success: false, error: "Payment amount does not match invoice total.", code: "AMOUNT_MISMATCH" };
  }

  const subscriptionId = invoice.subscription_id;
  const packageId = invoice.package_id;
  const billingCycle = invoice.billing_cycle || "monthly";
  const now = new Date();

  if (subscriptionId) {
    const { data: sub } = await d
      .from("organization_subscriptions")
      .select("id, organization_id, package_id, status, trial_ends_at")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (!sub) {
      return { success: false, error: "Referenced subscription not found.", code: "SUB_NOT_FOUND" };
    }

    if (sub.organization_id !== organizationId) {
      return { success: false, error: "Subscription organization mismatch.", code: "SUB_ORG_MISMATCH" };
    }
  }

  await d
    .from("org_subscription_payments")
    .update({
      status: "paid",
      provider_payment_id: providerPaymentId,
      provider_signature_verified: true,
      paid_at: now.toISOString(),
    })
    .eq("id", paymentDbId);

  await d
    .from("org_subscription_invoices")
    .update({
      status: "paid",
      razorpay_payment_id: providerPaymentId,
      paid_at: now.toISOString(),
    })
    .eq("id", invoiceId);

  const days = BILLING_DAYS[billingCycle] || 30;
  const periodEnd = new Date(now.getTime() + days * 86400000).toISOString();
  const nextBillingDate = periodEnd;

  let finalSubscriptionId = subscriptionId;

  if (subscriptionId) {
    const { data: sub } = await d
      .from("organization_subscriptions")
      .select("id, status, trial_ends_at")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (sub) {
      await d
        .from("organization_subscriptions")
        .update({
          package_id: packageId || sub.package_id,
          status: "active",
          billing_period: billingCycle,
          trial_ends_at: sub.trial_ends_at ? now.toISOString() : sub.trial_ends_at,
          started_at: now.toISOString(),
          expires_at: periodEnd,
          next_billing_date: nextBillingDate,
          latest_invoice_id: invoiceId,
          latest_payment_id: paymentDbId || null,
          updated_at: now.toISOString(),
        })
        .eq("id", subscriptionId);

      if (sub.status === "trial") {
        await d
          .from("subscription_events")
          .insert({
            organization_id: organizationId,
            subscription_id: subscriptionId,
            event_type: "trial_converted",
            actor_id: null,
            new_state: { packageId, billingCycle, invoiceId },
            reason: "Trial converted to paid via webhook",
            created_at: now.toISOString(),
          });
      }
    }
  } else {
    const resolvedPackageId = packageId || "";
    const { data: ns } = await d
      .from("organization_subscriptions")
      .insert({
        organization_id: organizationId,
        package_id: resolvedPackageId,
        status: "active",
        billing_period: billingCycle,
        started_at: now.toISOString(),
        expires_at: periodEnd,
        next_billing_date: nextBillingDate,
        latest_invoice_id: invoiceId,
        latest_payment_id: paymentDbId || null,
        provider: "razorpay",
        provider_environment: providerEnvironment,
        auto_renew: true,
      })
      .select("id")
      .maybeSingle();

    if (ns) {
      finalSubscriptionId = ns.id;
    }
  }

  let entitlementSyncStatus: "completed" | "failed" | "skipped" = "skipped";
  try {
    const { syncEntitlementsAction, syncUsageLimitsAction } = await import(
      "@/features/subscription/super-admin-actions"
    );
    const [eRes, lRes] = await Promise.all([
      syncEntitlementsAction(organizationId),
      syncUsageLimitsAction(organizationId),
    ]);
    entitlementSyncStatus = eRes.ok && lRes.ok ? "completed" : "failed";
  } catch {
    entitlementSyncStatus = "failed";
  }

  await d
    .from("subscription_events")
    .insert([
      {
        organization_id: organizationId,
        subscription_id: finalSubscriptionId || null,
        event_type: "payment_finalized",
        actor_id: null,
        new_state: { providerOrderId, providerPaymentId, invoiceId, amount: paymentAmount },
        reason: `Webhook: payment ${providerPaymentId} finalized via ${eventId}`,
        created_at: now.toISOString(),
      },
      {
        organization_id: organizationId,
        subscription_id: finalSubscriptionId || null,
        event_type: "invoice_paid",
        actor_id: null,
        new_state: { invoiceId, paymentId: providerPaymentId, status: "paid" },
        reason: `Invoice ${invoiceId} marked paid via webhook`,
        created_at: now.toISOString(),
      },
      {
        organization_id: organizationId,
        subscription_id: finalSubscriptionId || null,
        event_type: entitlementSyncStatus === "completed" ? "entitlement_sync_completed" : "entitlement_sync_failed",
        actor_id: null,
        new_state: { status: entitlementSyncStatus },
        reason: `Entitlement sync after payment ${entitlementSyncStatus}`,
        created_at: now.toISOString(),
      },
    ]);

  return {
    success: true,
    invoiceId,
    paymentId: paymentDbId,
    subscriptionId: finalSubscriptionId || "",
    wasAlreadyFinalized: false,
    entitlementSyncStatus,
  };
}
