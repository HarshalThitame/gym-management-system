"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayPaymentSignature } from "@/features/billing/razorpay/razorpay-service";
import { getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";
import { verifyRazorpayPaymentSchema, type VerifyRazorpayPaymentInput } from "./schemas";

type VerifyResult = {
  success: boolean;
  paymentId?: string;
  invoiceId?: string;
  subscriptionId?: string | undefined;
  subscriptionStatus?: string;
  packageName?: string;
  billingCycle?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  nextBillingDate?: string;
  entitlementSyncStatus?: string;
  warning?: string;
  error?: string;
};

const BILLING_DAYS: Record<string, number> = { monthly: 30, annual: 365 };

export async function verifySubscriptionRazorpayPaymentAction(
  input: VerifyRazorpayPaymentInput,
): Promise<VerifyResult> {
  try {
    const parsed = verifyRazorpayPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoiceId, organizationId, subscriptionId, packageId } = parsed.data;

    // 1. Auth: user must be org owner or super admin
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Authentication required." };

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id as never)
      .maybeSingle();
    const profileOrgId = (profile as unknown as { organization_id: string } | null)?.organization_id;
    if (profileOrgId !== organizationId) {
      return { success: false, error: "You can only verify payments for your own organization." };
    }

    // 2. Verify Razorpay signature
    const sigResult = verifyRazorpayPaymentSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });
    if (!sigResult.isValid) {
      await recordEvent(supabase, organizationId, "payment_verification_failed", user.id, {
        razorpay_order_id, razorpay_payment_id, invoiceId, reason: "Invalid signature",
      });
      return { success: false, error: "Payment signature verification failed." };
    }

    // 3. Fetch invoice
    const { data: invoice } = await supabase
      .from("org_subscription_invoices" as never)
      .select("*")
      .eq("id" as never, invoiceId)
      .maybeSingle() as any;
    if (!invoice) return { success: false, error: "Invoice not found." };
    if (invoice.organization_id !== organizationId) return { success: false, error: "Invoice does not belong to this organization." };
    if (invoice.status === "paid") {
      return { success: true, invoiceId, paymentId: razorpay_payment_id, warning: "Invoice already paid." };
    }
    if (invoice.razorpay_order_id && invoice.razorpay_order_id !== razorpay_order_id) {
      return { success: false, error: "Razorpay order ID does not match invoice." };
    }

    // 4. Fetch package
    const { data: pkg } = await supabase
      .from("packages")
      .select("id, name, is_active")
      .eq("id", packageId as never)
      .maybeSingle() as any;
    if (!pkg) return { success: false, error: "Package not found." };
    if (!pkg.is_active) return { success: false, error: "Package is not active." };

    const adminDb = getSupabaseAdminClient() as any;
    if (!adminDb) return { success: false, error: "Database connection failed." };

    const billingCycle = invoice.billing_cycle || "monthly";
    const days = BILLING_DAYS[billingCycle] || 30;
    const periodStart = new Date().toISOString();
    const periodEnd = new Date(Date.now() + days * 86400000).toISOString();
    const nextBilling = new Date(Date.now() + days * 86400000).toISOString();

    // 5. Update payment record — create or update
    const { data: existingPayments } = await adminDb
      .from("org_subscription_payments")
      .select("id, status")
      .eq("provider_payment_id", razorpay_payment_id);
    const existingPayment = (existingPayments ?? [])[0];

    let paymentDbId: string;
    if (existingPayment) {
      paymentDbId = existingPayment.id;
      if (existingPayment.status === "paid") {
        // Already verified — idempotent
      } else {
        await adminDb.from("org_subscription_payments").update({
          status: "paid",
          provider_signature_verified: true,
          paid_at: new Date().toISOString(),
        }).eq("id", existingPayment.id);
      }
    } else {
      const { data: newPayment } = await adminDb.from("org_subscription_payments").insert({
        organization_id: organizationId,
        subscription_id: subscriptionId || null,
        invoice_id: invoiceId,
        payment_number: `PAY-${organizationId.slice(0, 8)}-${String(Date.now()).slice(-6)}`,
        status: "paid",
        provider: "razorpay",
        provider_environment: getRazorpayEnvironment(),
        provider_order_id: razorpay_order_id,
        provider_payment_id: razorpay_payment_id,
        provider_signature_verified: true,
        amount: invoice.total_amount || invoice.subtotal_amount || 0,
        currency: invoice.currency || "INR",
        paid_at: new Date().toISOString(),
      }).select("id").maybeSingle();
      paymentDbId = newPayment?.id;
    }

    // 6. Update invoice to paid
    await adminDb.from("org_subscription_invoices").update({
      status: "paid",
      razorpay_payment_id: razorpay_payment_id,
      paid_at: new Date().toISOString(),
    }).eq("id", invoiceId);

    // 7. Activate or renew subscription
    const existingSubId = subscriptionId;
    let subId = existingSubId;

    if (existingSubId) {
      // Check if it's a trial conversion
      const { data: existingSub } = await adminDb
        .from("organization_subscriptions")
        .select("id, status, trial_ends_at")
        .eq("id", existingSubId)
        .maybeSingle();

      if (existingSub) {
        await adminDb.from("organization_subscriptions").update({
          package_id: packageId,
          status: "active",
          billing_period: billingCycle,
          trial_ends_at: existingSub.trial_ends_at ? new Date().toISOString() : undefined,
          started_at: periodStart,
          expires_at: periodEnd,
          next_billing_date: nextBilling,
          latest_invoice_id: invoiceId,
          latest_payment_id: paymentDbId || null,
          updated_at: new Date().toISOString(),
        }).eq("id", existingSubId);

        // Record trial conversion event if was trial
        if (existingSub.status === "trial") {
          await adminDb.from("subscription_events").insert({
            organization_id: organizationId,
            subscription_id: existingSubId,
            event_type: "trial_converted",
            actor_id: user.id,
            new_state: { packageId, billingCycle, invoiceId },
            reason: "Trial converted to paid via Razorpay payment",
            created_at: new Date().toISOString(),
          });
        }
      } else {
        subId = undefined;
      }
    }

    if (!subId) {
      const { data: newSub } = await adminDb.from("organization_subscriptions").insert({
        organization_id: organizationId,
        package_id: packageId,
        status: "active",
        billing_period: billingCycle,
        started_at: periodStart,
        expires_at: periodEnd,
        next_billing_date: nextBilling,
        latest_invoice_id: invoiceId,
        latest_payment_id: paymentDbId || null,
        provider: "razorpay",
        provider_environment: getRazorpayEnvironment(),
        auto_renew: true,
      }).select("id").maybeSingle();
      subId = newSub?.id;
    }

    // 8. Sync entitlements
    let entitlementSyncStatus = "completed";
    try {
      const { syncEntitlementsAction, syncUsageLimitsAction } = await import(
        "@/features/subscription/super-admin-actions"
      );
      const [eRes, lRes] = await Promise.all([
        syncEntitlementsAction(organizationId),
        syncUsageLimitsAction(organizationId),
      ]);
      if (!eRes.ok || !lRes.ok) {
        entitlementSyncStatus = "failed";
      }
    } catch {
      entitlementSyncStatus = "failed";
    }

    // 9. Record audit events
    await adminDb.from("subscription_events").insert([
      {
        organization_id: organizationId,
        subscription_id: subId || null,
        event_type: "payment_verified",
        actor_id: user.id,
        new_state: { razorpay_order_id, razorpay_payment_id, invoiceId, amount: invoice.total_amount },
        reason: `Razorpay payment ${razorpay_payment_id} verified`,
        created_at: new Date().toISOString(),
      },
      {
        organization_id: organizationId,
        subscription_id: subId || null,
        event_type: "invoice_paid",
        actor_id: user.id,
        new_state: { invoiceId, paymentId: razorpay_payment_id, status: "paid" },
        reason: `Invoice ${invoiceId} marked paid`,
        created_at: new Date().toISOString(),
      },
      {
        organization_id: organizationId,
        subscription_id: subId || null,
        event_type: entitlementSyncStatus === "completed" ? "entitlement_sync_completed" : "entitlement_sync_failed",
        actor_id: user.id,
        new_state: { status: entitlementSyncStatus },
        reason: `Entitlement sync after payment ${entitlementSyncStatus}`,
        created_at: new Date().toISOString(),
      },
    ]);

    const result: VerifyResult = {
      success: true,
      paymentId: paymentDbId,
      invoiceId,
      subscriptionId: subId,
      subscriptionStatus: "active",
      packageName: pkg.name,
      billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextBillingDate: nextBilling,
      entitlementSyncStatus,
    };

    if (entitlementSyncStatus === "failed") {
      result.warning = "Payment verified but entitlement sync failed. Please contact support.";
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}

async function recordEvent(supabase: any, orgId: string, eventType: string, actorId: string, metadata: Record<string, unknown>) {
  try {
    await supabase.from("subscription_events" as never).insert({
      organization_id: orgId,
      event_type: eventType,
      actor_id: actorId,
      metadata,
      new_state: metadata,
      created_at: new Date().toISOString(),
    });
  } catch { /* silent */ }
}
