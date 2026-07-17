"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { calculateTax } from "@/features/billing/services/tax-service";
import { getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";
import { resolvePlatformRazorpayCredentials } from "@/features/billing/razorpay/platform-razorpay-config";
import {
  createRazorpayCustomer,
  createRazorpayPlan,
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  getRazorpayKeyId,
  verifyRazorpaySubscriptionSignature,
} from "@/features/billing/razorpay/razorpay-service";
import { syncSubscriptionArtifactsForOrganization } from "@/features/super-admin/services/subscription-entitlement-sync";
import { billingLogger } from "@/features/billing/lib/logger";
import { sendEmail } from "@/services/email/resend";
import {
  dunningFirstAttempt,
  dunningSecondAttempt,
  subscriptionInvoiceNotification,
  subscriptionSuspendedNotification,
} from "@/emails/subscription";


export type OrgAutoDebitCheckoutInput = {
  targetPackageId: string;
  billingCycle: "monthly" | "annual";
  startMode?: "now" | "later";
};

export type OrgAutoDebitCheckoutResult =
  | {
      success: true;
      provider: "razorpay";
      razorpayKeyId: string;
      razorpaySubscriptionId: string;
      razorpayCustomerId: string;
      amountPaise: number;
      subtotalPaise: number;
      taxPaise: number;
      currency: string;
      subscriptionId: string;
      packageDisplayName: string;
      organizationDisplayName: string;
      billingCycle: string;
      isTestMode: boolean;
      environmentLabel: string;
    }
  | {
      success: false;
      error: string;
    };

export type OrgAutoDebitAcknowledgementInput = {
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type OrgAutoDebitAcknowledgementResult =
  | {
      success: true;
      status: "signature_acknowledged" | "subscription_confirmed" | "already_processed" | "awaiting_webhook";
      subscriptionId?: string;
      paymentId?: string;
      warning?: string;
    }
  | {
      success: false;
      error: string;
    };

type OrgRow = {
  id: string;
  name: string;
  billing_email: string | null;
  owner_user_id: string | null;
};

type PackageRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type PricingRow = {
  id: string;
  package_id: string;
  billing_period: "monthly" | "annual";
  price: number;
  currency: string;
  provider_plan_id: string | null;
  is_active: boolean;
};

type OrgSubscriptionRow = {
  id: string;
  organization_id: string;
  package_id: string;
  status: string;
  billing_period: string | null;
  billing_engine: string | null;
  cancelled_at: string | null;
  auto_renew: boolean | null;
  provider_subscription_id: string | null;
  provider_plan_id: string | null;
  provider_customer_id: string | null;
  provider_mandate_id: string | null;
  provider_payment_method_id: string | null;
  next_billing_date: string | null;
  expires_at: string | null;
  latest_invoice_id: string | null;
  latest_payment_id: string | null;
  price_override: number | null;
  started_at: string | null;
  provider_environment: string | null;
};

type OrgPaymentMethodRow = {
  id: string;
  organization_id: string;
  provider: string;
  provider_customer_id: string | null;
  provider_payment_method_id: string | null;
  provider_mandate_id: string | null;
  mandate_status: string | null;
  payment_type: string;
  display_name: string;
  last_four: string | null;
  card_network: string | null;
  is_default: boolean;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
};

function getDaysForBillingPeriod(period: string | null | undefined): number {
  return period === "annual" ? 365 : 30;
}

function toRupees(paise: number): number {
  return Math.max(0, Math.round(paise) / 100);
}

async function resolvePricingRow(admin: ReturnType<typeof getSupabaseAdminClient>, packageId: string, billingCycle: "monthly" | "annual") {
  const { data } = await admin
    .from("package_pricing")
    .select("*")
    .eq("package_id", packageId)
    .eq("billing_period", billingCycle)
    .eq("is_active", true)
    .maybeSingle() as never as {
    data: PricingRow | null;
    error: { message: string } | null;
  };

  if (!data) {
    return null;
  }
  return data;
}

async function ensureProviderPlan(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  pricing: PricingRow,
  planName: string,
  credentials: Awaited<ReturnType<typeof resolvePlatformRazorpayCredentials>>,
): Promise<{ ok: true; planId: string } | { ok: false; error: string }> {
  if (pricing.provider_plan_id) {
    return { ok: true, planId: pricing.provider_plan_id };
  }

  const period = pricing.billing_period;
  const planResult = await createRazorpayPlan({
    period,
    amount: toRupees(pricing.price),
    currency: pricing.currency || "INR",
    name: `${planName} - ${period}`,
    notes: {
      package_id: pricing.package_id,
      billing_period: period,
      source: "org_autodebit",
    },
    credentials,
  });

  if (!planResult.ok) {
    billingLogger.error("org-autodebit", "Razorpay plan creation failed", {
      packageId: pricing.package_id,
      billingPeriod: period,
      amountPaise: pricing.price,
      currency: pricing.currency || "INR",
      error: planResult.error,
    });
    return { ok: false, error: planResult.message };
  }

  await admin
    .from("package_pricing")
    .update({ provider_plan_id: planResult.data.id } as never)
    .eq("id", pricing.id);

  return { ok: true, planId: planResult.data.id };
}

async function resolveOrgContact(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, organization: OrgRow) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone")
    .eq("id", organization.owner_user_id || "")
    .maybeSingle() as never as {
    data: { full_name: string | null; email: string | null; phone: string | null } | null;
    error: { message: string } | null;
  };

  return {
    name: profile?.full_name || organization.name,
    email: organization.billing_email || profile?.email || "",
    phone: profile?.phone || "",
  };
}

async function resolveOrgContactWithAdmin(admin: ReturnType<typeof getSupabaseAdminClient>, organization: OrgRow) {
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email, phone")
    .eq("id", organization.owner_user_id || "")
    .maybeSingle() as never as {
    data: { full_name: string | null; email: string | null; phone: string | null } | null;
    error: { message: string } | null;
  };

  return {
    name: profile?.full_name || organization.name,
    email: organization.billing_email || profile?.email || "",
    phone: profile?.phone || "",
  };
}

async function getDefaultOrgPaymentMethod(admin: ReturnType<typeof getSupabaseAdminClient>, organizationId: string) {
  const { data } = await admin
    .from("org_payment_methods")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle() as never as {
    data: OrgPaymentMethodRow | null;
    error: { message: string } | null;
  };

  return data ?? null;
}

async function getOrganizationDetails(admin: ReturnType<typeof getSupabaseAdminClient>, organizationId: string): Promise<OrgRow | null> {
  const { data } = await admin
    .from("organizations")
    .select("id, name, billing_email, owner_user_id")
    .eq("id", organizationId)
    .maybeSingle() as never as {
    data: OrgRow | null;
    error: { message: string } | null;
  };

  return data ?? null;
}

async function getPackageDetails(admin: ReturnType<typeof getSupabaseAdminClient>, packageId: string): Promise<PackageRow | null> {
  const { data } = await admin
    .from("packages")
    .select("id, name, is_active")
    .eq("id", packageId)
    .maybeSingle() as never as {
    data: PackageRow | null;
    error: { message: string } | null;
  };

  return data ?? null;
}

function buildReceiptNumber(prefix: string): string {
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;
}

function normalizeOrgMandatePaymentType(value: unknown): "card" | "upi" | "net_banking" | "emandate" {
  if (value === "card" || value === "upi" || value === "net_banking" || value === "emandate") {
    return value;
  }
  return "emandate";
}

async function upsertOrgMandatePaymentMethod(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  organizationId: string,
  input: {
    provider: "razorpay";
    providerCustomerId?: string | null;
    providerPaymentMethodId: string;
    providerMandateId?: string | null;
    mandateStatus?: string | null;
    paymentType?: string | null;
    displayName?: string | null;
    lastFour?: string | null;
    cardNetwork?: string | null;
    expiryMonth?: number | null;
    expiryYear?: number | null;
  providerEnvironment?: string | null;
  },
): Promise<string | null> {
  const providerPaymentMethodId = input.providerPaymentMethodId.trim();
  if (!providerPaymentMethodId) return null;

  const { data: existingByProvider } = await admin
    .from("org_payment_methods")
    .select("id, display_name, payment_type, last_four, expiry_month, expiry_year, card_network, is_default, provider_customer_id, provider_payment_method_id, provider_mandate_id, mandate_status, metadata")
    .eq("organization_id", organizationId)
    .eq("provider_payment_method_id", providerPaymentMethodId)
    .maybeSingle() as never as {
    data: OrgPaymentMethodRow | null;
    error: { message: string } | null;
  };

  const targetRow = existingByProvider ?? await (async () => {
    const { data } = await admin
      .from("org_payment_methods")
      .select("id, display_name, payment_type, last_four, expiry_month, expiry_year, card_network, is_default, provider_customer_id, provider_payment_method_id, provider_mandate_id, mandate_status, metadata")
      .eq("organization_id", organizationId)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle() as never as {
      data: OrgPaymentMethodRow | null;
      error: { message: string } | null;
    };
    return data ?? null;
  })();

  const resolvedDisplayName = input.displayName
    || targetRow?.display_name
    || "Razorpay auto-debit";

  const resolvedPaymentType = normalizeOrgMandatePaymentType(input.paymentType);
  const resolvedMetadata = {
    ...(targetRow?.metadata && typeof targetRow.metadata === "object" ? targetRow.metadata : {}),
    source: "org_autodebit",
    providerEnvironment: input.providerEnvironment ?? null,
  };

  const payload = {
    organization_id: organizationId,
    provider: input.provider,
    provider_customer_id: input.providerCustomerId ?? targetRow?.provider_customer_id ?? null,
    provider_payment_method_id: providerPaymentMethodId,
    provider_mandate_id: input.providerMandateId ?? targetRow?.provider_mandate_id ?? null,
    mandate_status: input.mandateStatus ?? targetRow?.mandate_status ?? null,
    payment_type: resolvedPaymentType,
    display_name: resolvedDisplayName,
    last_four: input.lastFour ?? targetRow?.last_four ?? null,
    expiry_month: input.expiryMonth ?? targetRow?.expiry_month ?? null,
    expiry_year: input.expiryYear ?? targetRow?.expiry_year ?? null,
    card_network: input.cardNetwork ?? targetRow?.card_network ?? null,
    is_default: true,
    is_active: true,
    metadata: resolvedMetadata,
    updated_at: new Date().toISOString(),
  };

  if (targetRow?.id) {
    if (!targetRow.is_default) {
      await admin.from("org_payment_methods").update({ is_default: false } as never).eq("organization_id", organizationId).eq("is_default", true);
    }
    await admin.from("org_payment_methods").update(payload as never).eq("id", targetRow.id).eq("organization_id", organizationId);
    return targetRow.id;
  } else {
    await admin.from("org_payment_methods").update({ is_default: false } as never).eq("organization_id", organizationId).eq("is_default", true);
    const { data } = await admin
      .from("org_payment_methods")
      .insert(payload as never)
      .select("id")
      .maybeSingle() as never as {
      data: { id: string } | null;
      error: { message: string } | null;
    };
    return data?.id ?? null;
  }

  return null;
}

export async function createOrgAutoDebitCheckoutAction(input: OrgAutoDebitCheckoutInput): Promise<OrgAutoDebitCheckoutResult> {
  const { targetPackageId, billingCycle } = input;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const ctx = await requireOrganizationOwner("/organization/plan");

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { success: false, error: "Database connection failed." };
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, billing_email, owner_user_id")
    .eq("id", ctx.organizationId)
    .maybeSingle() as never as {
    data: OrgRow | null;
    error: { message: string } | null;
  };

  if (!organization) {
    return { success: false, error: "Organization not found." };
  }

  const { data: pkg } = await supabase
    .from("packages")
    .select("id, name, is_active")
    .eq("id", targetPackageId)
    .maybeSingle() as never as {
    data: PackageRow | null;
    error: { message: string } | null;
  };

  if (!pkg || !pkg.is_active) {
    return { success: false, error: "Package is not available." };
  }

  const { data: currentSubscriptions } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("organization_id", organization.id)
    .in("status", ["active", "trial", "pending"])
    .order("started_at", { ascending: false })
    .limit(1) as never as {
    data: OrgSubscriptionRow[] | null;
    error: { message: string } | null;
  };

  const currentSubscription = (currentSubscriptions ?? [])[0] ?? null;
  if (currentSubscription && (currentSubscription.status === "active" || currentSubscription.status === "trial")) {
    return { success: false, error: "You already have an active plan. Please cancel the current plan before purchasing a new one." };
  }

  const pricing = await resolvePricingRow(admin, targetPackageId, billingCycle);
  if (!pricing) {
    return { success: false, error: `No pricing found for ${billingCycle} billing cycle.` };
  }

  let subtotalPaise = pricing.price;
  const currency = pricing.currency || "INR";

  if (currentSubscription?.price_override) {
    subtotalPaise = currentSubscription.price_override;
  }

  if (subtotalPaise <= 0) {
    return { success: false, error: "Invalid pricing configuration." };
  }

  let taxPaise = 0;
  try {
    const tax = await calculateTax({ subtotal: subtotalPaise, organizationId: organization.id });
    taxPaise = tax.totalTax;
  } catch {
    taxPaise = 0;
  }

  const totalAmountPaise = subtotalPaise + taxPaise;
  const contact = await resolveOrgContact(supabase, organization);

  const platformCredentials = await resolvePlatformRazorpayCredentials();
  const providerEnvironment = platformCredentials?.environment ?? getRazorpayEnvironment();
  const planResult = await ensureProviderPlan(admin, pricing, pkg.name, platformCredentials);
  if (!planResult.ok) {
    return { success: false, error: planResult.error };
  }

  const defaultPaymentMethod = await getDefaultOrgPaymentMethod(admin, organization.id);
  let providerCustomerId = defaultPaymentMethod?.provider_customer_id ?? null;
  if (!providerCustomerId) {
    const customerResult = await createRazorpayCustomer({
      name: contact.name,
      email: contact.email || `${organization.id}@org.local`,
      contact: contact.phone || undefined,
      notes: {
        organization_id: organization.id,
        package_id: pkg.id,
        billing_period: billingCycle,
        source: "org_autodebit",
      },
    }, platformCredentials);
    if (!customerResult.ok) {
      return { success: false, error: customerResult.message };
    }
    providerCustomerId = customerResult.data.id;
  }

  const subscriptionResult = await createRazorpaySubscription({
    planId: planResult.planId,
    customerId: providerCustomerId,
    totalCount: 1200,
    notes: {
      organization_id: organization.id,
      package_id: pkg.id,
      billing_period: billingCycle,
      source: "org_autodebit",
    },
  }, platformCredentials);

  if (!subscriptionResult.ok) {
    return { success: false, error: subscriptionResult.message };
  }

  const nextChargeAt = subscriptionResult.data.charge_at
    ? new Date(subscriptionResult.data.charge_at * 1000).toISOString()
    : new Date(Date.now() + getDaysForBillingPeriod(billingCycle) * 86400000).toISOString();

  if (currentSubscription?.id && currentSubscription.status === "cancelled") {
    await admin.from("organization_subscriptions").delete().eq("id", currentSubscription.id);
  }

  const upsertPayload = {
    organization_id: organization.id,
    package_id: pkg.id,
    status: "pending",
    billing_engine: "subscription",
    billing_period: billingCycle,
    started_at: new Date().toISOString(),
    expires_at: nextChargeAt,
    next_billing_date: nextChargeAt,
    auto_renew: true,
    provider: "razorpay",
    provider_environment: providerEnvironment,
    provider_subscription_id: subscriptionResult.data.id,
    provider_plan_id: planResult.planId,
    provider_customer_id: providerCustomerId,
    provider_payment_method_id: defaultPaymentMethod?.provider_payment_method_id ?? null,
    provider_mandate_id: defaultPaymentMethod?.provider_mandate_id ?? null,
    latest_invoice_id: currentSubscription?.latest_invoice_id ?? null,
    latest_payment_id: currentSubscription?.latest_payment_id ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: subscriptionRow, error: subscriptionError } = await admin
    .from("organization_subscriptions")
    .upsert(upsertPayload, { onConflict: "organization_id" })
    .select("*")
    .maybeSingle() as never as {
    data: OrgSubscriptionRow | null;
    error: { message: string } | null;
  };

  if (subscriptionError || !subscriptionRow) {
    return { success: false, error: subscriptionError?.message ?? "Failed to create subscription record." };
  }

  await admin.from("subscription_events").insert({
    organization_id: organization.id,
    subscription_id: subscriptionRow.id,
    event_type: "subscription_checkout_created",
    new_state: {
      providerSubscriptionId: subscriptionResult.data.id,
      providerPlanId: planResult.planId,
      providerCustomerId,
      amount: totalAmountPaise,
      billingCycle,
      status: "pending",
    },
    metadata: {
      source: "org_autodebit",
      providerEnvironment,
      packageId: pkg.id,
    },
    reason: `Razorpay subscription ${subscriptionResult.data.id} created for ${pkg.name} (${billingCycle})`,
    created_at: new Date().toISOString(),
  } as never);

  billingLogger.info("org-autodebit", "Checkout created", {
    organizationId: organization.id,
    packageId: pkg.id,
    subscriptionId: subscriptionResult.data.id,
    billingCycle,
  });

  return {
    success: true,
    provider: "razorpay",
    razorpayKeyId: getRazorpayKeyId(platformCredentials),
    razorpaySubscriptionId: subscriptionResult.data.id,
    razorpayCustomerId: providerCustomerId,
    amountPaise: totalAmountPaise,
    subtotalPaise,
    taxPaise,
    currency,
    subscriptionId: subscriptionRow.id,
    packageDisplayName: pkg.name,
    organizationDisplayName: organization.name ?? "",
    billingCycle,
    isTestMode: providerEnvironment === "test",
    environmentLabel: providerEnvironment === "test" ? "Test Mode" : "Live Mode",
  };
}

export async function acknowledgeOrgAutoDebitCheckoutAction(
  input: OrgAutoDebitAcknowledgementInput,
): Promise<OrgAutoDebitAcknowledgementResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const ctx = await requireOrganizationOwner("/organization/plan");

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { success: false, error: "Database connection failed." };
  }

  const platformCredentials = await resolvePlatformRazorpayCredentials();

  const sigOk = verifyRazorpaySubscriptionSignature({
    subscriptionId: input.razorpay_subscription_id,
    paymentId: input.razorpay_payment_id,
    signature: input.razorpay_signature,
  }, platformCredentials);
  if (!sigOk) {
    return { success: false, error: "Subscription signature verification failed." };
  }

  const { data: dbSub } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .eq("provider_subscription_id", input.razorpay_subscription_id)
    .maybeSingle() as never as {
    data: OrgSubscriptionRow | null;
    error: { message: string } | null;
  };

  if (!dbSub) {
    return { success: false, error: "Pending subscription not found." };
  }

  const providerSub = await fetchRazorpaySubscription(input.razorpay_subscription_id, platformCredentials);
  if (!providerSub.ok) {
    return { success: false, error: providerSub.message };
  }

  const providerStatus = providerSub.data.status || "authenticated";
  const nextBillingDate = providerSub.data.current_end
    ? new Date(providerSub.data.current_end * 1000).toISOString()
    : dbSub.next_billing_date;
  const providerMandateId = typeof (providerSub.data as never as Record<string, unknown>).mandate_id === "string"
    ? (providerSub.data as never as Record<string, unknown>).mandate_id as string
    : dbSub.provider_mandate_id;
  const providerPaymentMethodKey = providerMandateId || `subscription:${input.razorpay_subscription_id}`;

  await upsertOrgMandatePaymentMethod(admin, ctx.organizationId, {
    provider: "razorpay",
    providerCustomerId: providerSub.data.customer_id || dbSub.provider_customer_id,
    providerPaymentMethodId: providerPaymentMethodKey,
    providerMandateId,
    mandateStatus: providerStatus,
    paymentType: "emandate",
    displayName: "Razorpay auto-debit",
    providerEnvironment: platformCredentials?.environment ?? getRazorpayEnvironment(),
  });

  await admin.from("organization_subscriptions").update({
    status: providerStatus === "active" ? "active" : dbSub.status,
    auto_renew: true,
    provider: "razorpay",
    provider_environment: platformCredentials?.environment ?? getRazorpayEnvironment(),
    provider_subscription_id: input.razorpay_subscription_id,
    provider_plan_id: providerSub.data.plan_id || dbSub.provider_plan_id,
    provider_customer_id: providerSub.data.customer_id || dbSub.provider_customer_id,
    provider_payment_method_id: providerPaymentMethodKey,
    next_billing_date: nextBillingDate,
    expires_at: nextBillingDate,
    latest_payment_id: dbSub.latest_payment_id,
    updated_at: new Date().toISOString(),
  } as never).eq("id", dbSub.id);

  await admin.from("org_subscription_payments").update({
    provider_signature_verified: true,
    provider_payment_id: input.razorpay_payment_id,
    provider_subscription_id: input.razorpay_subscription_id,
    status: providerStatus === "active" ? "processing" : "signature_acknowledged",
    updated_at: new Date().toISOString(),
  } as never).eq("organization_id", ctx.organizationId).eq("provider_subscription_id", input.razorpay_subscription_id);

  await admin.from("subscription_events").insert({
    organization_id: ctx.organizationId,
    subscription_id: dbSub.id,
    event_type: "subscription_authorized",
    actor_id: user.id,
    new_state: {
      providerSubscriptionId: input.razorpay_subscription_id,
      providerPaymentId: input.razorpay_payment_id,
      providerStatus,
    },
    metadata: {
      source: "checkout_callback",
      providerEnvironment: platformCredentials?.environment ?? getRazorpayEnvironment(),
    },
    reason: "Razorpay subscription authorization completed.",
    created_at: new Date().toISOString(),
  } as never);

  await syncSubscriptionArtifactsForOrganization(
    ctx.organizationId,
    "Organization auto-debit authorization acknowledged.",
  );

  revalidatePath("/organization");
  revalidatePath("/organization/plan");

  return {
    success: true,
    status: providerStatus === "active" ? "subscription_confirmed" : "awaiting_webhook",
    subscriptionId: dbSub.id,
    paymentId: input.razorpay_payment_id,
    warning: providerStatus === "active" ? undefined : "Authorization completed. Awaiting provider confirmation.",
  };
}

export async function handleOrgSubscriptionActivatedEvent(input: {
  providerSubscriptionId: string;
  providerEnvironment: string;
  eventId: string;
  payload?: Record<string, unknown>;
}): Promise<{ handled: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { handled: false, error: "Database connection failed." };

  const { data: subscription } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("provider_subscription_id", input.providerSubscriptionId)
    .maybeSingle() as never as {
    data: OrgSubscriptionRow | null;
    error: { message: string } | null;
  };

  if (!subscription) return { handled: false, error: "No matching organization subscription found." };

  const providerSubscription = input.payload?.entity && typeof input.payload.entity === "object"
    ? input.payload.entity as Record<string, unknown>
    : null;
  let nextBillingDateFromPayload = providerSubscription?.current_end && Number(providerSubscription.current_end) > 0
    ? new Date(Number(providerSubscription.current_end) * 1000).toISOString()
    : null;

  if (!nextBillingDateFromPayload) {
    const platformCredentials = await resolvePlatformRazorpayCredentials();
    const providerSub = await fetchRazorpaySubscription(input.providerSubscriptionId, platformCredentials);
    if (providerSub.ok && providerSub.data.current_end) {
      nextBillingDateFromPayload = new Date(providerSub.data.current_end * 1000).toISOString();
    }
  }

  if (!nextBillingDateFromPayload) {
    nextBillingDateFromPayload = subscription.next_billing_date;
  }

  await admin.from("organization_subscriptions").update({
    status: "active",
    auto_renew: true,
    provider: "razorpay",
    provider_environment: input.providerEnvironment,
    provider_subscription_id: input.providerSubscriptionId,
    provider_plan_id: subscription.provider_plan_id,
    provider_customer_id: subscription.provider_customer_id,
    provider_mandate_id: typeof providerSubscription?.mandate_id === "string" ? providerSubscription.mandate_id : subscription.provider_mandate_id,
    provider_payment_method_id: typeof providerSubscription?.mandate_id === "string"
      ? providerSubscription.mandate_id
      : subscription.provider_mandate_id ?? `subscription:${input.providerSubscriptionId}`,
    next_billing_date: nextBillingDateFromPayload,
    expires_at: nextBillingDateFromPayload,
    updated_at: new Date().toISOString(),
  } as never).eq("id", subscription.id);

  await admin.from("subscription_events").insert({
    organization_id: subscription.organization_id,
    subscription_id: subscription.id,
    event_type: "subscription_activated",
    new_state: {
      providerSubscriptionId: input.providerSubscriptionId,
      nextBillingDate: nextBillingDateFromPayload,
    },
    metadata: {
      source: "webhook",
      providerEnvironment: input.providerEnvironment,
      eventId: input.eventId,
    },
    reason: "Razorpay subscription activated.",
    created_at: new Date().toISOString(),
  } as never);

  await syncSubscriptionArtifactsForOrganization(
    subscription.organization_id,
    "Organization auto-debit subscription activated.",
  );

  revalidatePath("/organization");
  revalidatePath("/organization/plan");

  return { handled: true };
}

export async function handleOrgSubscriptionChargedEvent(input: {
  providerSubscriptionId: string;
  providerPaymentId: string;
  providerEnvironment: string;
  eventId: string;
  providerOrderId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<{ handled: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { handled: false, error: "Database connection failed." };

  const { data: subscription } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("provider_subscription_id", input.providerSubscriptionId)
    .maybeSingle() as never as {
    data: OrgSubscriptionRow | null;
    error: { message: string } | null;
  };

  if (!subscription) return { handled: false, error: "No matching organization subscription found." };

  const pricing = await resolvePricingRow(admin, subscription.package_id, (subscription.billing_period as "monthly" | "annual") || "monthly");
  if (!pricing) return { handled: false, error: "Missing pricing row for subscription." };
  const packageDetails = await getPackageDetails(admin, subscription.package_id);
  const organization = await getOrganizationDetails(admin, subscription.organization_id);
  const expectedAmount = subscription.price_override ?? pricing.price;
  const currency = pricing.currency || "INR";
  const now = new Date();
  const periodDays = getDaysForBillingPeriod(subscription.billing_period);
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + periodDays);

  const idempotencyKey = `org_sub_charge_${subscription.id}_${input.providerPaymentId}`;
  const { data: existingPayment } = await admin
    .from("org_subscription_payments")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle() as never as {
    data: { id: string; status: string } | null;
    error: { message: string } | null;
  };

  if (existingPayment?.status === "paid") {
    return { handled: true };
  }

  const invoiceNumber = `ORG-SUB-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
  const { data: invoice, error: invoiceError } = await admin
    .from("org_subscription_invoices")
    .insert({
      organization_id: subscription.organization_id,
      subscription_id: subscription.id,
      package_id: subscription.package_id,
      payment_method_id: null,
      provider: "razorpay",
      provider_environment: input.providerEnvironment,
      provider_subscription_id: input.providerSubscriptionId,
      invoice_number: invoiceNumber,
      status: "paid",
      currency,
      subtotal_amount: expectedAmount,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: expectedAmount,
      amount_paid: expectedAmount,
      billing_period_start: now.toISOString().slice(0, 10),
      billing_period_end: periodEnd.toISOString().slice(0, 10),
      billing_cycle: subscription.billing_period || "monthly",
      issued_at: now.toISOString(),
      paid_at: now.toISOString(),
      due_at: now.toISOString(),
      idempotency_key: idempotencyKey,
      razorpay_payment_id: input.providerPaymentId,
    } as never)
    .select("*")
    .maybeSingle() as never as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (invoiceError || !invoice) {
    return { handled: false, error: invoiceError?.message ?? "Failed to create organization invoice." };
  }

  const paymentNumber = `ORG-SUB-PAY-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
  const { data: payment, error: paymentError } = await admin
    .from("org_subscription_payments")
    .insert({
      organization_id: subscription.organization_id,
      subscription_id: subscription.id,
      invoice_id: invoice.id,
      payment_number: paymentNumber,
      status: "paid",
      provider: "razorpay",
      provider_environment: input.providerEnvironment,
      provider_subscription_id: input.providerSubscriptionId,
      provider_order_id: input.providerOrderId ?? null,
      provider_payment_id: input.providerPaymentId,
      amount: expectedAmount,
      currency,
      payment_method_id: null,
      provider_signature_verified: true,
      paid_at: now.toISOString(),
      idempotency_key: idempotencyKey,
    } as never)
    .select("*")
    .maybeSingle() as never as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (paymentError || !payment) {
    return { handled: false, error: paymentError?.message ?? "Failed to create organization payment." };
  }

  const providerSubscription = input.payload?.entity && typeof input.payload.entity === "object"
    ? input.payload.entity as Record<string, unknown>
    : null;
  const paymentEntity = input.payload?.payload && typeof input.payload.payload === "object"
    ? (((input.payload.payload as Record<string, unknown>).payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined)
    : null;
  const cardEntity = paymentEntity?.card && typeof paymentEntity.card === "object"
    ? paymentEntity.card as Record<string, unknown>
    : null;
  const providerMandateId = typeof providerSubscription?.mandate_id === "string"
    ? providerSubscription.mandate_id
    : subscription.provider_mandate_id;
  const providerPaymentMethodKey = providerMandateId || `subscription:${input.providerSubscriptionId}`;
  const orgPaymentMethodId = await upsertOrgMandatePaymentMethod(admin, subscription.organization_id, {
      provider: "razorpay",
      providerCustomerId: subscription.provider_customer_id,
      providerPaymentMethodId: providerPaymentMethodKey,
      providerMandateId,
      mandateStatus: typeof providerSubscription?.status === "string" ? providerSubscription.status : "active",
      paymentType: typeof paymentEntity?.method === "string" ? paymentEntity.method : "emandate",
      displayName: typeof paymentEntity?.method === "string" ? `Razorpay ${paymentEntity.method}` : "Razorpay auto-debit",
      lastFour: typeof cardEntity?.last4 === "string" ? cardEntity.last4 : null,
      cardNetwork: typeof cardEntity?.network === "string" ? cardEntity.network : null,
      providerEnvironment: input.providerEnvironment,
    });

  if (orgPaymentMethodId) {
    await admin.from("org_subscription_invoices").update({
      payment_method_id: orgPaymentMethodId,
    } as never).eq("id", invoice.id);
    await admin.from("org_subscription_payments").update({
      payment_method_id: orgPaymentMethodId,
    } as never).eq("id", payment.id);
  }

  await admin.from("organization_subscriptions").update({
    status: "active",
    last_billing_date: now.toISOString(),
    next_billing_date: periodEnd.toISOString(),
    expires_at: periodEnd.toISOString(),
    latest_invoice_id: invoice.id,
    latest_payment_id: payment.id,
    provider: "razorpay",
    provider_environment: input.providerEnvironment,
    provider_subscription_id: input.providerSubscriptionId,
    provider_plan_id: subscription.provider_plan_id,
    provider_customer_id: subscription.provider_customer_id,
    provider_payment_method_id: providerPaymentMethodKey,
    auto_renew: true,
    updated_at: now.toISOString(),
  } as never).eq("id", subscription.id);

  await admin.from("subscription_events").insert({
    organization_id: subscription.organization_id,
    subscription_id: subscription.id,
    event_type: "subscription_charged",
    new_state: {
      providerSubscriptionId: input.providerSubscriptionId,
      providerPaymentId: input.providerPaymentId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      amount: expectedAmount,
      nextBillingDate: periodEnd.toISOString(),
    },
    metadata: {
      source: "webhook",
      providerEnvironment: input.providerEnvironment,
      eventId: input.eventId,
      providerOrderId: input.providerOrderId ?? null,
    },
    reason: `Razorpay subscription charge captured for ${subscription.billing_period} billing.`,
    created_at: now.toISOString(),
  } as never);

  await syncSubscriptionArtifactsForOrganization(
    subscription.organization_id,
    "Organization auto-debit charge captured.",
  );

  revalidatePath("/organization");
  revalidatePath("/organization/plan");

  const orgOwner = organization
    ? await resolveOrgContactWithAdmin(admin, organization)
    : { name: "Your Organization", email: "", phone: "" };

  if (orgOwner.email) {
    await sendEmail({
      to: orgOwner.email,
      subject: `Payment received — ${invoiceNumber}`,
      html: subscriptionInvoiceNotification({
        orgName: organization?.name ?? "Your Organization",
        planName: packageDetails?.name ?? "Subscription",
        amount: expectedAmount,
        dueDate: periodEnd.toISOString(),
        invoiceNumber,
        paymentLink: "",
      }),
    }).catch(() => {});
  }

  billingLogger.info("org-autodebit", "Subscription charged", {
    subscriptionId: subscription.id,
    invoiceId: invoice.id,
    paymentId: payment.id,
  });

  return { handled: true };
}

export async function handleOrgSubscriptionChargeFailedEvent(input: {
  providerSubscriptionId: string;
  failureReason: string;
  providerEnvironment: string;
  eventId: string;
  providerPaymentId?: string | null;
}): Promise<{ handled: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { handled: false, error: "Database connection failed." };

  const { data: subscription } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("provider_subscription_id", input.providerSubscriptionId)
    .maybeSingle() as never as {
    data: OrgSubscriptionRow | null;
    error: { message: string } | null;
  };

  if (!subscription) return { handled: false, error: "No matching organization subscription found." };

  const pricing = await resolvePricingRow(admin, subscription.package_id, (subscription.billing_period as "monthly" | "annual") || "monthly");
  if (!pricing) return { handled: false, error: "Missing pricing row for subscription." };
  const packageDetails = await getPackageDetails(admin, subscription.package_id);
  const organization = await getOrganizationDetails(admin, subscription.organization_id);
  const expectedAmount = subscription.price_override ?? pricing.price;

  const newFailureCount = (subscription.dunning_attempts ?? 0) + 1;
  const retryDays = [3, 5, 7][Math.min(newFailureCount - 1, 2)] ?? 7;
  const nextRetry = new Date();
  nextRetry.setDate(nextRetry.getDate() + retryDays);
  const daysOverdue = Math.max(
    1,
    Math.ceil((Date.now() - new Date(subscription.dunning_next_retry ?? new Date().toISOString()).getTime()) / (1000 * 60 * 60 * 24)),
  );

  const updateData = newFailureCount >= 3
    ? {
        status: "suspended",
        dunning_attempts: newFailureCount,
        dunning_next_retry: null,
        updated_at: new Date().toISOString(),
      }
    : {
        status: "active",
        dunning_attempts: newFailureCount,
        dunning_next_retry: nextRetry.toISOString(),
        updated_at: new Date().toISOString(),
      };

  await admin.from("organization_subscriptions").update(updateData as never).eq("id", subscription.id);

  await admin.from("org_subscription_payments").insert({
    organization_id: subscription.organization_id,
    subscription_id: subscription.id,
    payment_number: buildReceiptNumber("ORG-SUB-FAIL"),
    status: "failed",
    provider: "razorpay",
    provider_environment: input.providerEnvironment,
    provider_subscription_id: input.providerSubscriptionId,
    provider_payment_id: input.providerPaymentId ?? null,
    amount: expectedAmount,
    currency: pricing.currency || "INR",
    failure_reason: input.failureReason,
    idempotency_key: `org_sub_fail_${subscription.id}_${input.providerPaymentId ?? input.eventId}`,
  } as never);

  await admin.from("subscription_events").insert({
    organization_id: subscription.organization_id,
    subscription_id: subscription.id,
    event_type: newFailureCount >= 3 ? "suspended" : "dunning_attempt",
    new_state: {
      providerSubscriptionId: input.providerSubscriptionId,
      failureReason: input.failureReason,
      failureCount: newFailureCount,
      nextRetry: newFailureCount >= 3 ? null : nextRetry.toISOString(),
    },
    metadata: {
      source: "webhook",
      providerEnvironment: input.providerEnvironment,
      eventId: input.eventId,
    },
    reason: newFailureCount >= 3
      ? "Auto-debit failed repeatedly. Subscription suspended."
      : `Auto-debit failed. Retry scheduled for ${nextRetry.toISOString()}.`,
    created_at: new Date().toISOString(),
  } as never);

  if (newFailureCount >= 3) {
    await syncSubscriptionArtifactsForOrganization(
      subscription.organization_id,
      "Organization auto-debit suspended after repeated failures.",
    );
  }

  const orgOwner = organization
    ? await resolveOrgContactWithAdmin(admin, organization)
    : { name: "Your Organization", email: "", phone: "" };

  if (orgOwner.email) {
    const failureHtml = newFailureCount >= 3
      ? subscriptionSuspendedNotification({ orgName: organization?.name ?? "Your Organization", planName: packageDetails?.name ?? "Subscription" })
      : newFailureCount === 1
        ? dunningFirstAttempt({
            orgName: organization?.name ?? "Your Organization",
        planName: packageDetails?.name ?? "Subscription",
        amount: expectedAmount,
        dueDate: subscription.next_billing_date ?? nextRetry.toISOString(),
      })
      : dunningSecondAttempt({
          orgName: organization?.name ?? "Your Organization",
          planName: packageDetails?.name ?? "Subscription",
          amount: expectedAmount,
          daysOverdue,
        });
    await sendEmail({
      to: orgOwner.email,
      subject: newFailureCount >= 3 ? "Subscription suspended due to payment failure" : "Payment failed — auto-debit retry scheduled",
      html: failureHtml,
    }).catch(() => {});
  }

  billingLogger.warn("org-autodebit", "Subscription charge failed", {
    subscriptionId: subscription.id,
    failureCount: newFailureCount,
    failureReason: input.failureReason,
  });

  revalidatePath("/organization");
  revalidatePath("/organization/plan");

  return { handled: true };
}
