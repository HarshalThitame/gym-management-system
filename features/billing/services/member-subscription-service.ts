import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";
import { createRazorpayOrder } from "@/features/billing/razorpay/razorpay-service";
import type { PaymentProviderName } from "@/features/billing/providers/provider-types";

type MemberPaymentMethod = {
  id: string;
  gym_id: string;
  member_id: string;
  provider: string;
  provider_customer_id: string;
  provider_payment_method_id: string;
  payment_type: string;
  display_name: string;
  last_four: string | null;
  card_network: string | null;
  is_default: boolean;
  is_active: boolean;
};

type MemberSubscription = {
  id: string;
  gym_id: string;
  member_id: string;
  membership_id: string;
  invoice_id: string | null;
  provider: string;
  provider_subscription_id: string | null;
  provider_plan_id: string | null;
  provider_customer_id: string | null;
  provider_payment_method_id: string | null;
  status: string;
  billing_period: string;
  amount: number;
  currency: string;
  current_period_end: string | null;
  next_charge_at: string | null;
  failure_count: number;
};

export async function getMemberPaymentMethods(memberId: string): Promise<{ ok: true; methods: MemberPaymentMethod[] } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data, error } = await admin
    .from("member_payment_methods")
    .select("*")
    .eq("member_id", memberId)
    .eq("is_active", true)
    .order("is_default", { ascending: false }) as never as {
    data: MemberPaymentMethod[] | null;
    error: { message: string } | null;
  };

  if (error) return { ok: false, message: error.message };
  return { ok: true, methods: data ?? [] };
}

export async function getMemberDefaultPaymentMethod(memberId: string): Promise<{ ok: true; method: MemberPaymentMethod } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data, error } = await admin
    .from("member_payment_methods")
    .select("*")
    .eq("member_id", memberId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle() as never as {
    data: MemberPaymentMethod | null;
    error: { message: string } | null;
  };

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "No saved payment methods" };
  return { ok: true, method: data };
}

export async function savePaymentMethod(params: {
  gymId: string;
  memberId: string;
  provider: PaymentProviderName;
  providerCustomerId: string;
  providerPaymentMethodId: string;
  paymentType: string;
  displayName: string;
  lastFour?: string;
  cardNetwork?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data: existing } = await admin
    .from("member_payment_methods")
    .select("id")
    .eq("member_id", params.memberId)
    .eq("provider_payment_method_id", params.providerPaymentMethodId)
    .maybeSingle() as never as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (existing) return { ok: true, id: existing.id };

  const { data, error } = await admin
    .from("member_payment_methods")
    .insert({
      gym_id: params.gymId,
      member_id: params.memberId,
      provider: params.provider,
      provider_customer_id: params.providerCustomerId,
      provider_payment_method_id: params.providerPaymentMethodId,
      payment_type: params.paymentType,
      display_name: params.displayName,
      last_four: params.lastFour ?? null,
      card_network: params.cardNetwork ?? null,
      expiry_month: params.expiryMonth ?? null,
      expiry_year: params.expiryYear ?? null,
      is_default: params.isDefault ?? false,
    } as never)
    .select("id")
    .maybeSingle() as never as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Failed to save payment method" };

  if (params.isDefault) {
    await admin.from("member_payment_methods")
      .update({ is_default: false } as never)
      .eq("member_id", params.memberId)
      .neq("id", data.id);
  }

  return { ok: true, id: data.id };
}

export async function deletePaymentMethod(methodId: string, memberId: string): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { error } = await admin
    .from("member_payment_methods")
    .update({ is_active: false } as never)
    .eq("id", methodId)
    .eq("member_id", memberId) as never as {
    error: { message: string } | null;
  };

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Payment method removed" };
}

export async function createSubscription(params: {
  gymId: string;
  memberId: string;
  membershipId: string;
  provider: PaymentProviderName;
  providerCustomerId: string;
  providerPaymentMethodId: string;
  providerPlanId: string;
  billingPeriod: string;
  amount: number;
  currency: string;
  nextChargeAt: string;
}): Promise<{ ok: true; subscription: MemberSubscription } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data, error } = await admin
    .from("member_subscriptions")
    .insert({
      gym_id: params.gymId,
      member_id: params.memberId,
      membership_id: params.membershipId,
      provider: params.provider,
      provider_customer_id: params.providerCustomerId,
      provider_payment_method_id: params.providerPaymentMethodId,
      provider_plan_id: params.providerPlanId,
      status: "active",
      billing_period: params.billingPeriod,
      amount: params.amount,
      currency: params.currency,
      next_charge_at: params.nextChargeAt,
    } as never)
    .select("*")
    .maybeSingle() as never as {
    data: MemberSubscription | null;
    error: { message: string } | null;
  };

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Failed to create subscription" };

  return { ok: true, subscription: data };
}

export async function cancelSubscription(subscriptionId: string, memberId: string): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const now = new Date().toISOString();

  const { error } = await admin
    .from("member_subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: now,
    } as never)
    .eq("id", subscriptionId)
    .eq("member_id", memberId)
    .eq("status", "active") as never as {
    error: { message: string } | null;
  };

  if (error) return { ok: false, message: error.message };

  await admin.from("memberships").update({
    auto_renew: false,
    last_renewed_by_cron_at: null,
  } as never).eq("id", (await getSubscriptionMembershipId(subscriptionId)).ok ? (await getSubscriptionMembershipId(subscriptionId)).data : "");

  return { ok: true, message: "Subscription cancelled" };
}

async function getSubscriptionMembershipId(subscriptionId: string): Promise<{ ok: true; data: string } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data } = await admin
    .from("member_subscriptions")
    .select("membership_id")
    .eq("id", subscriptionId)
    .maybeSingle() as never as {
    data: { membership_id: string } | null;
    error: { message: string } | null;
  };

  if (!data) return { ok: false, message: "Subscription not found" };
  return { ok: true, data: data.membership_id };
}

export async function getMemberSubscriptions(memberId: string): Promise<{ ok: true; subscriptions: MemberSubscription[] } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data, error } = await admin
    .from("member_subscriptions")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false }) as never as {
    data: MemberSubscription[] | null;
    error: { message: string } | null;
  };

  if (error) return { ok: false, message: error.message };
  return { ok: true, subscriptions: data ?? [] };
}

export type AutoBillingStatus = {
  hasPaymentMethod: boolean;
  hasActiveSubscription: boolean;
  autoRenewEnabled: boolean;
  paymentMethods: MemberPaymentMethod[];
  subscriptions: MemberSubscription[];
};

export async function getAutoBillingStatus(memberId: string, membershipId?: string): Promise<{ ok: true; status: AutoBillingStatus } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const [methodsResult, subsResult, membershipResult] = await Promise.all([
    getMemberPaymentMethods(memberId),
    getMemberSubscriptions(memberId),
    admin.from("memberships").select("auto_renew").eq("id", membershipId ?? "").maybeSingle() as never as {
      data: { auto_renew: boolean } | null;
      error: { message: string } | null;
    },
  ]);

  return {
    ok: true,
    status: {
      hasPaymentMethod: methodsResult.ok && methodsResult.methods.length > 0,
      hasActiveSubscription: subsResult.ok && subsResult.subscriptions.some((s) => s.status === "active"),
      autoRenewEnabled: membershipResult.data?.auto_renew ?? false,
      paymentMethods: methodsResult.ok ? methodsResult.methods : [],
      subscriptions: subsResult.ok ? subsResult.subscriptions : [],
    },
  };
}
