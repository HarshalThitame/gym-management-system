"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayPaymentSignature } from "@/features/billing/razorpay/razorpay-service";
import { getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";
import { finalizeSubscriptionPayment } from "@/features/billing/services/finalize-subscription-payment";
import type {
  PaymentAcknowledgementInput,
  PaymentAcknowledgementResult,
} from "@/features/billing/razorpay/razorpay-types";

const SUBSCRIPTION_MANAGER_ROLES = new Set(["organization_owner", "owner", "admin", "manager", "gym_admin"]);

function canManageSubscription(role: string | null | undefined, ownerUserId: string | null | undefined, userId: string): boolean {
  return ownerUserId === userId || (role ? SUBSCRIPTION_MANAGER_ROLES.has(role) : false);
}

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

    const { data: organization } = await supabase
      .from("organizations")
      .select("id, owner_user_id")
      .eq("id", organizationId)
      .maybeSingle();

    if (!organization) {
      return { success: false, error: "Organization not found." };
    }

    const { data: branchUser } = await supabase
      .from("branch_users")
      .select("role_name")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    const role = branchUser?.role_name;
    if (!canManageSubscription(role, organization.owner_user_id, user.id)) {
      return { success: false, error: "You do not have permission to verify payments." };
    }

    const adminDb = getSupabaseAdminClient();
    if (!adminDb) {
      return { success: false, error: "Database connection failed." };
    }
    const d = adminDb as any;

    const { data: payments } = await d
      .from("org_subscription_payments")
      .select("id, invoice_id, organization_id, subscription_id, status, provider_environment, provider_payment_id")
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

    if (payment.provider_payment_id && payment.provider_payment_id !== razorpay_payment_id) {
      return { success: false, error: "Payment ID does not match this order." };
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
      const paymentId = (payment.provider_payment_id || razorpay_payment_id) as string;
      const response: PaymentAcknowledgementResult = {
        success: true,
        status: "already_processed",
        invoiceId: invoice.id as string,
        subscriptionStatus: "active",
        ...(paymentId ? { paymentId } : {}),
        ...(payment.subscription_id ? { subscriptionId: payment.subscription_id as string } : {}),
      };
      return {
        ...response,
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

    const finalizeResult = await finalizeSubscriptionPayment({
      providerOrderId: razorpay_order_id,
      providerPaymentId: razorpay_payment_id,
      providerEnvironment: getRazorpayEnvironment(),
      eventId: `frontend:${razorpay_order_id}:${razorpay_payment_id}`,
    });

    if (finalizeResult.success) {
      const response: PaymentAcknowledgementResult = {
        success: true,
        status: "payment_confirmed",
        invoiceId: invoice.id as string,
        subscriptionStatus: "active",
        ...(finalizeResult.paymentId ? { paymentId: finalizeResult.paymentId } : { paymentId: razorpay_payment_id }),
        ...(finalizeResult.subscriptionId ? { subscriptionId: finalizeResult.subscriptionId } : {}),
      };
      return {
        ...response,
      };
    }

    const fallbackResponse: PaymentAcknowledgementResult = {
      success: true,
      status: "signature_acknowledged",
      invoiceId: invoice.id as string,
      paymentId: razorpay_payment_id,
      ...(payment.subscription_id ? { subscriptionId: payment.subscription_id as string } : {}),
      warning: "Payment received. Confirmation is in progress. Your plan will activate shortly.",
    };
    return fallbackResponse;
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

    const { data: branchUser } = await supabase
      .from("branch_users")
      .select("role_name")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    const role = branchUser?.role_name;
    if (role === "member" || role === "reception_staff" || role === "trainer") {
      return { success: false, error: "You do not have permission to check payment status." };
    }

    const adminDb = getSupabaseAdminClient();
    if (!adminDb) {
      return { success: false, error: "Database connection failed." };
    }
    const d = adminDb as any;

    const sigResult = verifyRazorpayPaymentSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    if (!sigResult.isValid) {
      return { success: false, error: "Payment signature verification failed." };
    }

    const { data: payments } = await d
      .from("org_subscription_payments")
      .select("id, invoice_id, organization_id, subscription_id, status, provider_environment, provider_payment_id")
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

    if (payment.provider_payment_id && payment.provider_payment_id !== razorpay_payment_id) {
      return { success: false, error: "Payment ID does not match this order." };
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
      const paymentId = (payment.provider_payment_id || razorpay_payment_id) as string;
      const response: PaymentAcknowledgementResult = {
        success: true,
        status: "payment_confirmed",
        invoiceId: invoice.id as string,
        subscriptionStatus: "active",
        ...(paymentId ? { paymentId } : {}),
        ...(payment.subscription_id ? { subscriptionId: payment.subscription_id as string } : {}),
      };
      return {
        ...response,
      };
    }

    if (payment.status === "signature_acknowledged" || payment.status === "created") {
      const finalizeResult = await finalizeSubscriptionPayment({
        providerOrderId: razorpay_order_id,
        providerPaymentId: razorpay_payment_id,
        providerEnvironment: getRazorpayEnvironment(),
        eventId: `status:${razorpay_order_id}:${razorpay_payment_id}`,
      });

      if (finalizeResult.success) {
        const response: PaymentAcknowledgementResult = {
          success: true,
          status: "payment_confirmed",
          invoiceId: invoice.id as string,
          subscriptionStatus: "active",
          ...(finalizeResult.paymentId ? { paymentId: finalizeResult.paymentId } : { paymentId: razorpay_payment_id }),
          ...(finalizeResult.subscriptionId ? { subscriptionId: finalizeResult.subscriptionId } : {}),
        };
        return {
          ...response,
        };
      }

      const fallbackResponse: PaymentAcknowledgementResult = {
        success: true,
        status: "signature_acknowledged",
        invoiceId: invoice.id as string,
        paymentId: razorpay_payment_id,
        ...(payment.subscription_id ? { subscriptionId: payment.subscription_id as string } : {}),
        warning: "Payment received. Confirmation is in progress.",
      };
      return fallbackResponse;
    }

    const processingResponse: PaymentAcknowledgementResult = {
      success: true,
      status: "signature_acknowledged",
      invoiceId: invoice.id as string,
      paymentId: razorpay_payment_id,
      ...(payment.subscription_id ? { subscriptionId: payment.subscription_id as string } : {}),
      warning: "Payment is being processed.",
    };
    return processingResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}
