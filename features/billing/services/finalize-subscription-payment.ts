import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FinalizePaymentInput, FinalizePaymentResult } from "@/features/billing/razorpay/razorpay-types";
import { syncOrganizationEntitlements, syncOrganizationUsageLimits } from "@/features/subscription/entitlement-sync-service";

type FinalizeRpcPayload = {
  success?: boolean;
  error?: string;
  code?: string;
  invoiceId?: string;
  paymentId?: string;
  subscriptionId?: string;
  wasAlreadyFinalized?: boolean;
};

type FinalizeRpcClient = {
  rpc(
    name: "finalize_razorpay_subscription_payment",
    args: {
      p_provider_order_id: string;
      p_provider_payment_id: string;
      p_provider_environment: string;
      p_event_id: string;
    },
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

function parseFinalizePayload(value: unknown): FinalizeRpcPayload {
  return value && typeof value === "object" ? value as FinalizeRpcPayload : {};
}

export async function finalizeSubscriptionPayment(
  input: FinalizePaymentInput,
): Promise<FinalizePaymentResult> {
  const { providerOrderId, providerPaymentId, providerEnvironment, eventId } = input;

  const adminDb = getSupabaseAdminClient();
  if (!adminDb) {
    return { success: false, error: "Database connection failed.", code: "DB_CONNECTION_FAILED" };
  }

  const finalizeClient = adminDb as unknown as FinalizeRpcClient;
  const { data, error } = await finalizeClient.rpc("finalize_razorpay_subscription_payment", {
    p_provider_order_id: providerOrderId,
    p_provider_payment_id: providerPaymentId,
    p_provider_environment: providerEnvironment,
    p_event_id: eventId,
  });

  if (error) {
    return { success: false, error: error.message, code: "FINALIZE_RPC_FAILED" };
  }

  const payload = parseFinalizePayload(data);
  if (!payload.success) {
    return {
      success: false,
      error: payload.error ?? "Payment finalization failed.",
      code: payload.code ?? "PAYMENT_FINALIZE_FAILED",
    };
  }

  let entitlementSyncStatus: "completed" | "failed" | "skipped" = payload.wasAlreadyFinalized ? "skipped" : "failed";
  if (!payload.wasAlreadyFinalized && payload.subscriptionId) {
    const organizationId = await getOrganizationIdForSubscription(payload.subscriptionId);
    if (organizationId) {
      const [entitlements, limits] = await Promise.all([
        syncOrganizationEntitlements(organizationId, "Entitlements synced after Razorpay payment."),
        syncOrganizationUsageLimits(organizationId, "Usage limits synced after Razorpay payment."),
      ]);
      entitlementSyncStatus = entitlements.ok && limits.ok ? "completed" : "failed";
    }
  }

  return {
    success: true,
    invoiceId: payload.invoiceId ?? "",
    paymentId: payload.paymentId ?? "",
    subscriptionId: payload.subscriptionId ?? "",
    wasAlreadyFinalized: Boolean(payload.wasAlreadyFinalized),
    entitlementSyncStatus,
  };
}

async function getOrganizationIdForSubscription(subscriptionId: string): Promise<string> {
  const adminDb = getSupabaseAdminClient();
  if (!adminDb) return "";
  const { data } = await adminDb
    .from("organization_subscriptions")
    .select("organization_id")
    .eq("id", subscriptionId)
    .maybeSingle();
  return data?.organization_id ?? "";
}
