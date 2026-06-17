"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayPaymentSignature } from "@/features/billing/razorpay/razorpay-service";
import { getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";
import type {
  PaymentAcknowledgementInput,
  PaymentAcknowledgementResult,
} from "@/features/billing/razorpay/razorpay-types";

export async function acknowledgeRazorpayCheckoutResultAction(
  input: PaymentAcknowledgementInput,
): Promise<PaymentAcknowledgementResult> {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !profile.organization_id) {
      return { success: false, error: "User is not associated with an organization." };
    }

    const organizationId = profile.organization_id;

    const { data: branchUser } = await supabase
      .from("branch_users")
      .select("role_name")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    const role = branchUser?.role_name;
    if (role === "member" || role === "reception_staff" || role === "trainer") {
      return { success: false, error: "You do not have permission to verify payments." };
    }

    const adminDb = getSupabaseAdminClient();
    if (!adminDb) {
      return { success: false, error: "Database connection failed." };
    }
    const d = adminDb as any;

    const { data: payments } = await d
      .from("org_subscription_payments")
      .select("id, invoice_id, organization_id, status, provider_environment")
      .eq("provider_order_id", razorpay_order_id);

    const payment = (payments ?? [])[0] as Record<string, unknown> | undefined;

    if (!payment) {
      return { success: false, error: "No matching payment record found." };
    }

    if (payment.organization_id !== organizationId) {
      return { success: false, error: "Payment does not belong to your organization." };
    }

    if (payment.provider_environment !== getRazorpayEnvironment()) {
      return { success: false, error: "Provider environment mismatch." };
    }

    const { data: invoice } = await d
      .from("org_subscription_invoices")
      .select("id, organization_id, status")
      .eq("id", payment.invoice_id)
      .maybeSingle();

    if (!invoice) {
      return { success: false, error: "Invoice not found." };
    }

    if (invoice.organization_id !== organizationId) {
      return { success: false, error: "Invoice does not belong to your organization." };
    }

    if (invoice.status === "paid") {
      return {
        success: true,
        status: "already_processed",
        invoiceId: invoice.id,
        subscriptionStatus: "active",
      };
    }

    const sigResult = verifyRazorpayPaymentSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    if (!sigResult.isValid) {
      await d
        .from("subscription_events")
        .insert({
          organization_id: organizationId,
          event_type: "payment_verification_failed",
          actor_id: user.id,
          new_state: { razorpay_order_id, razorpay_payment_id, invoice_id: payment.invoice_id, reason: "Invalid signature" },
          reason: "Payment signature verification failed from frontend callback",
          created_at: new Date().toISOString(),
        });
      return { success: false, error: "Payment signature verification failed." };
    }

    await d
      .from("org_subscription_payments")
      .update({
        provider_signature_verified: true,
        provider_payment_id: razorpay_payment_id,
        status: "signature_acknowledged",
      })
      .eq("id", payment.id);

    await d
      .from("subscription_events")
      .insert({
        organization_id: organizationId,
        subscription_id: payment.subscription_id as string | null,
        event_type: "payment_signature_acknowledged",
        actor_id: user.id,
        new_state: { razorpay_order_id, razorpay_payment_id, invoice_id: payment.invoice_id },
        reason: `Frontend callback acknowledged for payment ${razorpay_payment_id}`,
        created_at: new Date().toISOString(),
      });

    const { data: webhookPayment } = await d
      .from("org_subscription_payments")
      .select("status")
      .eq("id", payment.id)
      .maybeSingle();

    if (webhookPayment && webhookPayment.status === "paid") {
      return {
        success: true,
        status: "payment_confirmed",
        invoiceId: invoice.id,
        subscriptionStatus: "active",
      };
    }

    return {
      success: true,
      status: "signature_acknowledged",
      invoiceId: invoice.id,
      warning: "Payment received. Confirmation is in progress. Your plan will activate shortly.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}

export async function getSubscriptionPaymentStatusAction(
  input: PaymentAcknowledgementInput,
): Promise<PaymentAcknowledgementResult> {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !profile.organization_id) {
      return { success: false, error: "User is not associated with an organization." };
    }

    const organizationId = profile.organization_id;

    const adminDb = getSupabaseAdminClient();
    if (!adminDb) {
      return { success: false, error: "Database connection failed." };
    }
    const d = adminDb as any;

    const { data: payments } = await d
      .from("org_subscription_payments")
      .select("id, invoice_id, organization_id, status, provider_environment")
      .eq("provider_order_id", razorpay_order_id);

    const payment = (payments ?? [])[0] as Record<string, unknown> | undefined;

    if (!payment) {
      return { success: false, error: "No matching payment record found." };
    }

    if (payment.organization_id !== organizationId) {
      return { success: false, error: "Payment does not belong to your organization." };
    }

    const { data: invoice } = await d
      .from("org_subscription_invoices")
      .select("id, organization_id, status")
      .eq("id", payment.invoice_id)
      .maybeSingle();

    if (!invoice) {
      return { success: false, error: "Invoice not found." };
    }

    if (invoice.organization_id !== organizationId) {
      return { success: false, error: "Invoice does not belong to your organization." };
    }

    if (payment.status === "paid" && invoice.status === "paid") {
      return {
        success: true,
        status: "payment_confirmed",
        invoiceId: invoice.id,
        subscriptionStatus: "active",
      };
    }

    if (payment.status === "signature_acknowledged" || payment.status === "created") {
      return {
        success: true,
        status: "signature_acknowledged",
        invoiceId: invoice.id,
        warning: "Payment received. Confirmation is in progress.",
      };
    }

    return {
      success: true,
      status: "signature_acknowledged",
      invoiceId: invoice.id,
      warning: "Payment is being processed.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}
