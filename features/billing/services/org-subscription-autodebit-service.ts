"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { calculateTax } from "@/features/billing/services/tax-service";
import { getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";
import { resolvePlatformRazorpayCredentials } from "@/features/billing/razorpay/platform-razorpay-config";
import { getPayuApiBaseUrl } from "@/features/billing/payu/payu-config";
import {
  createRazorpayCustomer,
  createRazorpayPlan,
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  getRazorpayKeyId,
  verifyRazorpaySubscriptionSignature,
} from "@/features/billing/razorpay/razorpay-service";
import { resolvePlatformPayuCredentials } from "@/features/billing/payu/platform-payu-config";
import { getPlatformDefaultProvider } from "@/features/billing/services/platform-provider-config-service";
import { recordSubscriptionEvent } from "@/features/super-admin/services/subscription-events-service";
import { syncSubscriptionArtifactsForOrganization } from "@/features/super-admin/services/subscription-entitlement-sync";
import { billingLogger } from "@/features/billing/lib/logger";
import { sendEmail } from "@/services/email/resend";
import {
  dunningFirstAttempt,
  dunningSecondAttempt,
  subscriptionInvoiceNotification,
  subscriptionSuspendedNotification,
} from "@/emails/subscription";

type ActionState = { status: "idle" | "success" | "error"; message?: string };

export type OrgAutoDebitCheckoutInput = {
  targetPackageId: string;
  billingCycle: "monthly" | "annual";
  startMode?: "now" | "later";
  provider?: "razorpay" | "payu";
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
      success: true;
      provider: "payu";
      payuCheckoutForm: {
        action: string;
        fields: Record<string, string>;
      };
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

function buildPayuSubscriptionDetails(input: {
  amountInRupees: number;
  billingCycle: "monthly" | "annual";
  startDate: Date;
  endDate: Date;
}) {
  return `{billingAmount: ${input.amountInRupees.toFixed(2)},billingCurrency: INR,billingCycle: ${input.billingCycle === "annual" ? "YEARLY" : "MONTHLY"},billingInterval: 1,paymentStartDate: ${input.startDate.toISOString().slice(0, 10)},paymentEndDate: ${input.endDate.toISOString().slice(0, 10)}}`;
}

async function buildPayuSubscriptionHash(input: {
  merchantKey: string;
  merchantSalt: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  siDetails: string;
}) {
  const hashString = `${input.merchantKey}|${input.txnid}|${input.amount}|${input.productinfo}|${input.firstname}|${input.email}|${input.udf1}|${input.udf2}|${input.udf3}|${input.udf4}|${input.udf5}||||||${input.siDetails}|${input.merchantSalt}`;
  const digest = await globalThis.crypto.subtle.digest("SHA-512", new TextEncoder().encode(hashString));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createPayuOrgSubscriptionCheckout(input: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  organization: OrgRow;
  pkg: PackageRow;
  pricing: PricingRow;
  contact: { name: string; email: string; phone: string };
  billingCycle: "monthly" | "annual";
  subtotalPaise: number;
  taxPaise: number;
  totalAmountPaise: number;
  currentSubscription: OrgSubscriptionRow | null;
}): Promise<OrgAutoDebitCheckoutResult> {
  const platformCredentials = await resolvePlatformPayuCredentials();
  if (!platformCredentials) {
    return { success: false, error: "PayU is not configured for platform billing." };
  }

  const requestHeaders = await headers();
  const requestOrigin = getRequestOrigin(requestHeaders);
  const txnid = `ORG-PAYU-${input.organization.id}-${input.pkg.id}-${Date.now()}-${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
  const now = new Date();
  const periodDays = getDaysForBillingPeriod(input.billingCycle);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + periodDays);
  const amountInRupees = toRupees(input.totalAmountPaise);
  const productinfo = `${input.pkg.name} - ${input.billingCycle === "annual" ? "Annual" : "Monthly"} auto-debit`;
  const siDetails = buildPayuSubscriptionDetails({
    amountInRupees,
    billingCycle: input.billingCycle,
    startDate: now,
    endDate,
  });
  const hash = await buildPayuSubscriptionHash({
    merchantKey: platformCredentials.merchantKey,
    merchantSalt: platformCredentials.merchantSalt,
    txnid,
    amount: amountInRupees.toFixed(2),
    productinfo,
    firstname: input.contact.name || input.organization.name || "Organization",
    email: input.contact.email || input.organization.billing_email || `${input.organization.id}@org.local`,
    udf1: "organization_plan",
    udf2: input.organization.id,
    udf3: input.pkg.id,
    udf4: input.billingCycle,
    udf5: input.currentSubscription?.id ?? "",
    siDetails,
  });
  const callbackUrl = `${requestOrigin}/api/billing/payu/org-plan/return`;
  const checkoutUrl = `${getPayuApiBaseUrl(platformCredentials.environment)}/_payment`;

  const pendingUpsert = {
    organization_id: input.organization.id,
    package_id: input.pkg.id,
    status: "pending",
    billing_engine: "subscription",
    billing_period: input.billingCycle,
    started_at: now.toISOString(),
    expires_at: endDate.toISOString(),
    next_billing_date: endDate.toISOString(),
    auto_renew: true,
    provider: "payu",
    provider_environment: platformCredentials.environment,
    provider_subscription_id: txnid,
    provider_plan_id: `payu-plan:${input.pkg.id}:${input.billingCycle}`,
    provider_customer_id: input.organization.id,
    provider_payment_method_id: null,
    provider_mandate_id: null,
    latest_invoice_id: input.currentSubscription?.latest_invoice_id ?? null,
    latest_payment_id: input.currentSubscription?.latest_payment_id ?? null,
    updated_at: now.toISOString(),
  };

  await input.admin
    .from("organization_subscriptions")
    .upsert(pendingUpsert, { onConflict: "organization_id" })
    .select("*")
    .maybeSingle();

  await input.admin.from("subscription_events").insert({
    organization_id: input.organization.id,
    event_type: "subscription_checkout_created",
    new_state: {
      provider: "payu",
      providerSubscriptionId: txnid,
      amount: input.totalAmountPaise,
      billingCycle: input.billingCycle,
      status: "pending",
    },
    metadata: {
      source: "org_autodebit",
      providerEnvironment: platformCredentials.environment,
      packageId: input.pkg.id,
    },
    reason: `PayU subscription consent checkout created for ${input.pkg.name} (${input.billingCycle})`,
    created_at: now.toISOString(),
  } as never);

  billingLogger.info("org-autodebit", "PayU checkout created", {
    organizationId: input.organization.id,
    packageId: input.pkg.id,
    billingCycle: input.billingCycle,
  });

  return {
    success: true,
    provider: "payu",
    payuCheckoutForm: {
      action: checkoutUrl,
      fields: {
        key: platformCredentials.merchantKey,
        txnid,
        amount: amountInRupees.toFixed(2),
        productinfo,
        firstname: input.contact.name || input.organization.name || "Organization",
        email: input.contact.email || input.organization.billing_email || `${input.organization.id}@org.local`,
        phone: input.contact.phone || "",
        surl: callbackUrl,
        furl: callbackUrl,
        hash,
        service_provider: "payu_paisa",
        si: "4",
        si_details: siDetails,
        udf1: "organization_plan",
        udf2: input.organization.id,
        udf3: input.pkg.id,
        udf4: input.billingCycle,
        udf5: input.currentSubscription?.id ?? "",
      },
    },
    amountPaise: input.totalAmountPaise,
    subtotalPaise: input.subtotalPaise,
    taxPaise: input.taxPaise,
    currency: "INR",
    subscriptionId: txnid,
    packageDisplayName: input.pkg.name,
    organizationDisplayName: input.organization.name ?? "",
    billingCycle: input.billingCycle,
    isTestMode: platformCredentials.isTestMode,
    environmentLabel: platformCredentials.environment === "test" ? "Test Mode" : "Live Mode",
  };
}

function getRequestOrigin(requestHeaders: Headers) {
  const proto = requestHeaders.get("x-forwarded-proto") || "https";
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  if (host) {
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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

function parseSubRow(value: unknown): OrgSubscriptionRow | null {
  return value && typeof value === "object" ? value as OrgSubscriptionRow : null;
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
    provider: "razorpay" | "payu";
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
  const defaultProviderResult = await getPlatformDefaultProvider();
  const selectedProvider: "razorpay" | "payu" = input.provider
    ?? (defaultProviderResult.ok && (defaultProviderResult.config.provider === "payu" || defaultProviderResult.config.provider === "razorpay")
      ? defaultProviderResult.config.provider
      : "razorpay");

  if (selectedProvider === "payu") {
    return createPayuOrgSubscriptionCheckout({
      admin,
      organization,
      pkg,
      pricing,
      contact,
      billingCycle,
      subtotalPaise,
      taxPaise,
      totalAmountPaise,
      currentSubscription,
    });
  }

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

  const orgPaymentMethodId = await upsertOrgMandatePaymentMethod(admin, ctx.organizationId, {
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

export async function finalizePayuOrgSubscriptionCheckoutAction(input: {
  rawBody: string;
}): Promise<{ success: true; subscriptionId: string } | { success: false; error: string }> {
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

  const payload = Object.fromEntries(new URLSearchParams(input.rawBody).entries()) as Record<string, string>;
  const platformCredentials = await resolvePlatformPayuCredentials();
  if (!platformCredentials) {
    return { success: false, error: "PayU is not configured for platform billing." };
  }

  const status = (payload.status || "").toLowerCase();
  const udf1 = payload.udf1 || "";
  const udf2 = payload.udf2 || ctx.organizationId;
  const udf3 = payload.udf3 || "";
  const udf4 = payload.udf4 || "monthly";
  const subscriptionTxnId = payload.txnid || "";
  const paymentId = payload.mihpayid || "";

  const expectedHash = crypto.createHash("sha512")
    .update(`${platformCredentials.merchantSalt}|${status}|${payload.udf1 || ""}|${payload.udf2 || ""}|${payload.udf3 || ""}|${payload.udf4 || ""}|${payload.udf5 || ""}|${payload.udf6 || ""}|${payload.udf7 || ""}|${payload.udf8 || ""}|${payload.udf9 || ""}|${payload.udf10 || ""}|${payload.key || platformCredentials.merchantKey}`)
    .digest("hex")
    .toLowerCase();
  if ((payload.hash || "").toLowerCase() !== expectedHash) {
    return { success: false, error: "PayU signature verification failed." };
  }

  if (udf1 !== "organization_plan") {
    return { success: false, error: "Unsupported PayU payload." };
  }

  if (!subscriptionTxnId || !paymentId) {
    return { success: false, error: "Missing PayU transaction identifiers." };
  }

  const { data: existingSub } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("organization_id", udf2)
    .or(`provider_subscription_id.eq.${subscriptionTxnId},latest_payment_id.eq.${paymentId}`)
    .maybeSingle() as never as {
    data: OrgSubscriptionRow | null;
    error: { message: string } | null;
  };

  if (!existingSub) {
    return { success: false, error: "Pending PayU subscription not found." };
  }

  if (status !== "success" && status !== "captured" && status !== "completed") {
    await admin.from("organization_subscriptions").update({
      status: "pending",
      provider: "payu",
      provider_subscription_id: subscriptionTxnId,
      provider_payment_method_id: paymentId,
      updated_at: new Date().toISOString(),
    } as never).eq("id", existingSub.id);
    return { success: false, error: `PayU subscription returned ${status || "failed"}.` };
  }

  const billingCycle = (udf4 === "annual" ? "annual" : "monthly") as "monthly" | "annual";
  const pricing = await resolvePricingRow(admin, existingSub.package_id, billingCycle);
  if (!pricing) {
    return { success: false, error: "Missing pricing row for PayU subscription." };
  }
  const packageDetails = await getPackageDetails(admin, existingSub.package_id);
  const organization = await getOrganizationDetails(admin, existingSub.organization_id);
  const providerEnvironment = platformCredentials.isTestMode ? "test" : "live";
  const expectedAmount = existingSub.price_override ?? pricing.price;
  const now = new Date();
  const periodDays = getDaysForBillingPeriod(billingCycle);
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + periodDays);

  const orgPaymentMethodId = await upsertOrgMandatePaymentMethod(admin, existingSub.organization_id, {
    provider: "payu",
    providerCustomerId: existingSub.provider_customer_id || existingSub.organization_id,
    providerPaymentMethodId: paymentId,
    providerMandateId: paymentId,
    mandateStatus: "active",
    paymentType: "card",
    displayName: "PayU subscription mandate",
    providerEnvironment,
  });

  const invoiceNumber = `ORG-SUB-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
  const { data: invoice, error: invoiceError } = await admin
    .from("org_subscription_invoices")
    .insert({
      organization_id: existingSub.organization_id,
      subscription_id: existingSub.id,
      package_id: existingSub.package_id,
      payment_method_id: orgPaymentMethodId,
      provider: "payu",
      provider_environment: providerEnvironment,
      provider_subscription_id: subscriptionTxnId,
      invoice_number: invoiceNumber,
      status: "paid",
      currency: pricing.currency || "INR",
      subtotal_amount: expectedAmount,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: expectedAmount,
      amount_paid: expectedAmount,
      billing_period_start: now.toISOString().slice(0, 10),
      billing_period_end: periodEnd.toISOString().slice(0, 10),
      billing_cycle: billingCycle,
      issued_at: now.toISOString(),
      paid_at: now.toISOString(),
      due_at: now.toISOString(),
      idempotency_key: `payu_${existingSub.id}_${paymentId}`,
      razorpay_payment_id: null,
    } as never)
    .select("*")
    .maybeSingle() as never as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message ?? "Failed to create PayU invoice." };
  }

  const paymentNumber = `ORG-SUB-PAY-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
  const { data: payment, error: paymentError } = await admin
    .from("org_subscription_payments")
    .insert({
      organization_id: existingSub.organization_id,
      subscription_id: existingSub.id,
      invoice_id: invoice.id,
      payment_number: paymentNumber,
      status: "paid",
      provider: "payu",
      provider_environment: providerEnvironment,
      provider_subscription_id: subscriptionTxnId,
      provider_order_id: payload.txnid,
      provider_payment_id: paymentId,
      amount: expectedAmount,
      currency: pricing.currency || "INR",
      payment_method_id: orgPaymentMethodId,
      provider_signature_verified: true,
      paid_at: now.toISOString(),
      idempotency_key: `payu_${existingSub.id}_${paymentId}`,
    } as never)
    .select("*")
    .maybeSingle() as never as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (paymentError || !payment) {
    return { success: false, error: paymentError?.message ?? "Failed to create PayU payment." };
  }

  await admin.from("organization_subscriptions").update({
    status: "active",
    last_billing_date: now.toISOString(),
    next_billing_date: periodEnd.toISOString(),
    expires_at: periodEnd.toISOString(),
    latest_invoice_id: invoice.id,
    latest_payment_id: payment.id,
    provider: "payu",
    provider_environment: providerEnvironment,
    provider_subscription_id: subscriptionTxnId,
    provider_plan_id: existingSub.provider_plan_id || `payu-plan:${existingSub.package_id}:${billingCycle}`,
    provider_customer_id: existingSub.provider_customer_id || udf2,
    provider_payment_method_id: paymentId,
    provider_mandate_id: paymentId,
    auto_renew: true,
    updated_at: now.toISOString(),
  } as never).eq("id", existingSub.id);

  await admin.from("subscription_events").insert({
    organization_id: existingSub.organization_id,
    subscription_id: existingSub.id,
    event_type: "subscription_activated",
    new_state: {
      provider: "payu",
      providerSubscriptionId: subscriptionTxnId,
      providerPaymentId: paymentId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      billingCycle,
    },
    metadata: {
      source: "payu_callback",
      providerEnvironment,
      packageId: existingSub.package_id,
    },
    reason: `PayU subscription consent completed for ${packageDetails?.name ?? "plan"}.`,
    created_at: now.toISOString(),
  } as never);

  if (organization?.billing_email || organization?.owner_user_id) {
    await syncSubscriptionArtifactsForOrganization(
      existingSub.organization_id,
      "PayU subscription consent completed.",
    );
  }

  billingLogger.info("org-autodebit", "PayU subscription consent finalized", {
    subscriptionId: existingSub.id,
    providerSubscriptionId: subscriptionTxnId,
    udf3,
  });

  return { success: true, subscriptionId: existingSub.id };
}

export async function handlePayuOrgSubscriptionWebhookEvent(input: {
  notificationType: string;
  eventId: string;
  payload: Record<string, unknown>;
}): Promise<{ handled: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { handled: false, error: "Database connection failed." };

  const customParameter = input.payload.customParameter && typeof input.payload.customParameter === "object"
    ? input.payload.customParameter as Record<string, unknown>
    : {};
  const udf2 = typeof customParameter.organizationId === "string"
    ? customParameter.organizationId
    : typeof input.payload.udf2 === "string"
      ? input.payload.udf2
      : null;
  const orgSubscriptionId = typeof customParameter.organizationSubscriptionId === "string"
    ? customParameter.organizationSubscriptionId
    : typeof input.payload.subscriptionId === "string"
      ? input.payload.subscriptionId
      : typeof input.payload.planId === "string"
        ? input.payload.planId
        : typeof input.payload.txnid === "string"
          ? input.payload.txnid
          : null;

  if (!orgSubscriptionId) {
    return { handled: false, error: "Unable to resolve PayU organization subscription." };
  }

  let resolvedSubscription: OrgSubscriptionRow | null = null;
  if (udf2) {
    const { data: subscription } = await admin
      .from("organization_subscriptions")
      .select("*")
      .eq("organization_id", udf2)
      .eq("provider_subscription_id", orgSubscriptionId)
      .maybeSingle() as never as {
      data: OrgSubscriptionRow | null;
      error: { message: string } | null;
    };
    resolvedSubscription = subscription;
  }

  if (!resolvedSubscription) {
    const { data: fallbackSubscription } = await admin
      .from("organization_subscriptions")
      .select("*")
      .eq("provider_subscription_id", orgSubscriptionId)
      .eq("provider", "payu")
      .order("started_at", { ascending: false })
      .maybeSingle() as never as {
      data: OrgSubscriptionRow | null;
      error: { message: string } | null;
    };
    resolvedSubscription = fallbackSubscription;
  }

  if (!resolvedSubscription && udf2) {
    const { data: latestPayuSubscription } = await admin
      .from("organization_subscriptions")
      .select("*")
      .eq("organization_id", udf2)
      .eq("provider", "payu")
      .order("started_at", { ascending: false })
      .maybeSingle() as never as {
      data: OrgSubscriptionRow | null;
      error: { message: string } | null;
    };
    resolvedSubscription = latestPayuSubscription;
  }

  if (!resolvedSubscription) {
    return { handled: false, error: "No matching organization subscription found." };
  }

  const now = new Date().toISOString();
  const providerEnvironment = typeof input.payload.environment === "string"
    ? input.payload.environment
    : resolvedSubscription.provider_environment ?? "test";

  if (input.notificationType === "SUBSCRIPTION_CANCELLED_HTTP") {
    await admin.from("organization_subscriptions").update({
      status: "cancelled",
      auto_renew: false,
      provider: "payu",
      provider_environment: providerEnvironment,
      updated_at: now,
    } as never).eq("id", resolvedSubscription.id);
  } else if (input.notificationType === "SUBSCRIPTION_ENABLED_HTTP" || input.notificationType === "SUBSCRIPTION_DEFINED_HTTP") {
    await admin.from("organization_subscriptions").update({
      status: "active",
      auto_renew: true,
      provider: "payu",
      provider_environment: providerEnvironment,
      provider_subscription_id: orgSubscriptionId,
      updated_at: now,
    } as never).eq("id", resolvedSubscription.id);
  } else if (input.notificationType === "SUBSCRIPTION_COMPLETED_HTTP") {
    await admin.from("organization_subscriptions").update({
      status: "active",
      auto_renew: true,
      provider: "payu",
      provider_environment: providerEnvironment,
      updated_at: now,
    } as never).eq("id", resolvedSubscription.id);
  } else if (input.notificationType === "INVOICE_PAID_HTTP") {
    await admin.from("subscription_events").insert({
      organization_id: resolvedSubscription.organization_id,
      subscription_id: resolvedSubscription.id,
      event_type: "subscription_charged",
      new_state: {
        providerSubscriptionId: orgSubscriptionId,
        notificationType: input.notificationType,
      },
      metadata: {
        source: "payu_webhook",
        eventId: input.eventId,
        providerEnvironment,
      },
      reason: "PayU invoice paid webhook received.",
      created_at: now,
    } as never);
  } else if (input.notificationType === "INVOICE_FAILED_HTTP") {
    await admin.from("subscription_events").insert({
      organization_id: resolvedSubscription.organization_id,
      subscription_id: resolvedSubscription.id,
      event_type: "payment_failed",
      new_state: {
        providerSubscriptionId: orgSubscriptionId,
        notificationType: input.notificationType,
      },
      metadata: {
        source: "payu_webhook",
        eventId: input.eventId,
        providerEnvironment,
      },
      reason: "PayU invoice failed webhook received.",
      created_at: now,
    } as never);
  }

  await syncSubscriptionArtifactsForOrganization(
    resolvedSubscription.organization_id,
    "PayU subscription webhook processed.",
  );

  return { handled: true };
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

  const providerMandateId = typeof providerSubscription?.mandate_id === "string"
    ? providerSubscription.mandate_id
    : subscription.provider_mandate_id;

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
