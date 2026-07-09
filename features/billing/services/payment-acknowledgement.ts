"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { requireOrgFeatureAccess } from "@/features/entitlement";
import {
  acknowledgeOrgAutoDebitCheckoutAction,
  type OrgAutoDebitAcknowledgementInput,
  type OrgAutoDebitAcknowledgementResult,
} from "@/features/billing/services/org-subscription-autodebit-service";
import { fetchRazorpaySubscription } from "@/features/billing/razorpay/razorpay-service";
import { getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";

export async function acknowledgeRazorpayCheckoutResultAction(
  input: OrgAutoDebitAcknowledgementInput,
): Promise<OrgAutoDebitAcknowledgementResult> {
  return acknowledgeOrgAutoDebitCheckoutAction(input);
}

export async function getSubscriptionPaymentStatusAction(
  input: OrgAutoDebitAcknowledgementInput,
): Promise<OrgAutoDebitAcknowledgementResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const ctx = await requireOrganizationOwner("/organization/plan");
    await requireOrgFeatureAccess(ctx.organizationId, "billing_invoices");

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return { success: false, error: "Database connection failed." };
    }

    const { data: sub } = await admin
      .from("organization_subscriptions")
      .select("id, provider_subscription_id, status, latest_invoice_id")
      .eq("organization_id", ctx.organizationId)
      .eq("provider_subscription_id", input.razorpay_subscription_id)
      .maybeSingle() as never as {
      data: { id: string; provider_subscription_id: string | null; status: string; latest_invoice_id: string | null } | null;
      error: { message: string } | null;
    };

    if (!sub) {
      return { success: false, error: "Subscription not found." };
    }

    const providerSub = await fetchRazorpaySubscription(input.razorpay_subscription_id);
    if (!providerSub.ok) {
      return { success: false, error: providerSub.message };
    }

    const status = providerSub.data.status || sub.status;
    await admin.from("organization_subscriptions").update({
      status: status === "active" ? "active" : sub.status,
      provider_environment: getRazorpayEnvironment(),
      updated_at: new Date().toISOString(),
    } as never).eq("id", sub.id);

    return {
      success: true,
      status: status === "active" ? "subscription_confirmed" : "awaiting_webhook",
      subscriptionId: sub.id,
      warning: status === "active" ? undefined : "Subscription authorization is pending provider confirmation.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}

