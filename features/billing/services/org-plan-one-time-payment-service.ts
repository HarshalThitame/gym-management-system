"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { calculateTax } from "@/features/billing/services/tax-service";
import { getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";
import { resolvePlatformRazorpayCredentials } from "@/features/billing/razorpay/platform-razorpay-config";
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayKeyId,
  preflightRazorpayCredentials,
  verifyRazorpayPaymentSignature,
} from "@/features/billing/razorpay/razorpay-service";
import { syncSubscriptionArtifactsForOrganization } from "@/features/super-admin/services/subscription-entitlement-sync";
import { billingLogger } from "@/features/billing/lib/logger";
import { writeAuditLog } from "@/lib/audit";

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
  auto_renew: boolean | null;
  started_at: string | null;
  expires_at: string | null;
  next_billing_date: string | null;
  latest_invoice_id: string | null;
  latest_payment_id: string | null;
  provider_subscription_id: string | null;
  provider_plan_id: string | null;
  provider_customer_id: string | null;
  provider_mandate_id: string | null;
  provider_payment_method_id: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancellation_category: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
};

type PaymentRow = {
  id: string;
};

export const ORG_PLAN_ONE_TIME_CHECKOUT_TTL_MS = 30 * 60 * 1000;

export function getOrgPlanOneTimeCheckoutExpiresAt(createdAt: string | Date, ttlMs: number = ORG_PLAN_ONE_TIME_CHECKOUT_TTL_MS): Date {
  const startedAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return new Date(startedAt.getTime() + ttlMs);
}

export function isOrgPlanOneTimeCheckoutExpired(
  createdAt: string | Date,
  now: Date = new Date(),
  ttlMs: number = ORG_PLAN_ONE_TIME_CHECKOUT_TTL_MS,
): boolean {
  return now.getTime() >= getOrgPlanOneTimeCheckoutExpiresAt(createdAt, ttlMs).getTime();
}

type OrgPlanOneTimeCheckoutDraft = {
  subscription: OrgSubscriptionRow;
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    billing_cycle: string | null;
    created_at: string;
    failure_reason: string | null;
    dunning_status: string | null;
    dunning_last_failure_reason: string | null;
    razorpay_order_id: string | null;
    provider_environment: string | null;
    total_amount: number | null;
    subtotal_amount: number;
    tax_amount: number;
    currency: string;
  };
  payment: {
    id: string;
    status: string;
    created_at: string;
    provider_order_id: string | null;
    provider_payment_id: string | null;
    failure_reason: string | null;
    amount: number;
    currency: string;
  };
  package: PackageRow | null;
  billingCycle: "monthly" | "annual";
  amountPaise: number;
  currency: string;
  orderId: string;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  isCancelled: boolean;
  isFinalized: boolean;
};

export type OrgPlanOneTimeCheckoutState = {
  hasDraft: boolean;
  draft: OrgPlanOneTimeCheckoutDraft | null;
  status: "none" | "pending" | "expired" | "cancelled";
  message: string | null;
};

export type OrgPlanOneTimeCheckoutInput = {
  targetPackageId: string;
  billingCycle: "monthly" | "annual";
};

export type OrgPlanOneTimeCheckoutResult =
  | {
      success: true;
      provider: "razorpay";
      razorpayKeyId: string;
      razorpayOrderId: string;
      amountPaise: number;
      subtotalPaise: number;
      taxPaise: number;
      currency: string;
      invoiceId: string;
      paymentRecordId: string;
      subscriptionId: string;
      packageDisplayName: string;
      organizationDisplayName: string;
      billingCycle: string;
      isTestMode: boolean;
      environmentLabel: string;
      checkoutState: OrgPlanOneTimeCheckoutState;
    }
  | {
      success: false;
      error: string;
    };

export type OrgPlanOneTimeFinalizeInput = {
  invoiceId: string;
  paymentRecordId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
};

export type OrgPlanOneTimeFinalizeResult =
  | {
      success: true;
      status: "payment_confirmed" | "already_processed";
      invoiceId: string;
      paymentRecordId: string;
      subscriptionId: string;
      warning?: string;
    }
  | {
      success: false;
      error: string;
  };

function getDaysForBillingPeriod(period: string | null | undefined): number {
  return period === "annual" ? 365 : 30;
}

function toRupees(paise: number): number {
  return Math.max(0, Math.round(paise) / 100);
}

function buildInvoiceNumber(prefix: string): string {
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

function buildPaymentNumber(prefix: string): string {
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

function buildOrgPlanOneTimeInvoiceIdempotencyKey(
  subscriptionId: string,
  billingCycle: "monthly" | "annual",
  billingPeriodStart: string,
  billingPeriodEnd: string,
): string {
  return `org_plan_invoice:${subscriptionId}:${billingCycle}:${billingPeriodStart}:${billingPeriodEnd}`;
}

function buildOrgPlanOneTimePaymentIdempotencyKey(
  subscriptionId: string,
  billingCycle: "monthly" | "annual",
  billingPeriodStart: string,
  billingPeriodEnd: string,
): string {
  return `org_plan_payment:${subscriptionId}:${billingCycle}:${billingPeriodStart}:${billingPeriodEnd}`;
}

async function loadOrgPlanOneTimeCheckoutDraft(admin: ReturnType<typeof getSupabaseAdminClient>, organizationId: string): Promise<OrgPlanOneTimeCheckoutDraft | null> {
  const { data: subscriptions } = await admin
    .from("organization_subscriptions")
    .select("id, organization_id, package_id, status, billing_period, billing_engine, auto_renew, started_at, expires_at, next_billing_date, latest_invoice_id, latest_payment_id, provider_subscription_id, provider_plan_id, provider_customer_id, provider_mandate_id, provider_payment_method_id, cancelled_at, cancellation_reason, cancellation_category, updated_at")
    .eq("organization_id", organizationId)
    .eq("billing_engine", "invoice")
    .order("updated_at", { ascending: false })
    .limit(10) as never as {
    data: Array<OrgSubscriptionRow & { updated_at?: string | null }> | null;
    error: { message: string } | null;
  };

  for (const subscription of subscriptions ?? []) {
    if (!subscription.latest_invoice_id || !subscription.latest_payment_id) continue;
    const draft = await loadOrgPlanOneTimeCheckoutDraftForSubscription(admin, subscription);
    if (draft) return draft;
  }

  const { data: recentInvoices } = await admin
    .from("org_subscription_invoices")
    .select("id, organization_id, subscription_id, package_id, invoice_number, status, billing_cycle, created_at, failure_reason, dunning_status, dunning_last_failure_reason, razorpay_order_id, provider_environment, total_amount, subtotal_amount, tax_amount, currency")
    .eq("organization_id", organizationId)
    .eq("provider", "razorpay")
    .order("created_at", { ascending: false })
    .limit(20) as never as {
    data: Array<OrgPlanOneTimeCheckoutDraft["invoice"] & { subscription_id: string | null; package_id: string | null }> | null;
    error: { message: string } | null;
  };

  for (const invoice of recentInvoices ?? []) {
    if (!invoice.subscription_id || !invoice.package_id) continue;
    const { data: subscription } = await admin
      .from("organization_subscriptions")
      .select("id, organization_id, package_id, status, billing_period, billing_engine, auto_renew, started_at, expires_at, next_billing_date, latest_invoice_id, latest_payment_id, provider_subscription_id, provider_plan_id, provider_customer_id, provider_mandate_id, provider_payment_method_id, cancelled_at, cancellation_reason, cancellation_category, updated_at")
      .eq("id", invoice.subscription_id)
      .maybeSingle() as never as {
      data: (OrgSubscriptionRow & { updated_at?: string | null }) | null;
      error: { message: string } | null;
    };

    if (!subscription) continue;
    const draft = await loadOrgPlanOneTimeCheckoutDraftForSubscription(admin, subscription, invoice);
    if (draft) return draft;
  }

  return null;
}

async function loadOrgPlanOneTimeCheckoutDraftForSubscription(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  subscription: OrgSubscriptionRow & { updated_at?: string | null },
  invoiceOverride?: OrgPlanOneTimeCheckoutDraft["invoice"] & { subscription_id?: string | null; package_id?: string | null },
): Promise<OrgPlanOneTimeCheckoutDraft | null> {
  const paymentQuery = invoiceOverride
    ? admin
        .from("org_subscription_payments")
        .select("id, status, created_at, provider_order_id, provider_payment_id, failure_reason, amount, currency")
        .eq("invoice_id", invoiceOverride.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : admin
        .from("org_subscription_payments")
        .select("id, status, created_at, provider_order_id, provider_payment_id, failure_reason, amount, currency")
        .eq("id", subscription.latest_payment_id ?? "")
        .maybeSingle();

  const [invoiceRes, paymentRes, packageRes] = await Promise.all([
    invoiceOverride
      ? Promise.resolve({ data: invoiceOverride, error: null })
      : admin
          .from("org_subscription_invoices")
          .select("id, invoice_number, status, billing_cycle, created_at, failure_reason, dunning_status, dunning_last_failure_reason, razorpay_order_id, provider_environment, total_amount, subtotal_amount, tax_amount, currency")
          .eq("id", subscription.latest_invoice_id ?? "")
          .maybeSingle(),
    paymentQuery,
    admin
      .from("packages")
      .select("id, name, is_active")
      .eq("id", subscription.package_id)
      .maybeSingle(),
  ]);

  const invoice = (invoiceRes.data as OrgPlanOneTimeCheckoutDraft["invoice"] | null) ?? null;
  const payment = (paymentRes.data as OrgPlanOneTimeCheckoutDraft["payment"] | null) ?? null;
  const pkg = packageRes.data as PackageRow | null;
  if (!invoice) return null;

  const paymentRow = payment ?? null;
  const orderId = paymentRow?.provider_order_id ?? invoice.razorpay_order_id ?? "";
  if (!orderId) return null;

  const paymentCreatedAt = paymentRow?.created_at ?? invoice.created_at ?? subscription.updated_at ?? new Date().toISOString();
  const createdAt = paymentCreatedAt;
  const expiresAt = getOrgPlanOneTimeCheckoutExpiresAt(createdAt).toISOString();
  const now = new Date();
  const failureText = `${paymentRow?.failure_reason ?? ""} ${invoice.failure_reason ?? ""} ${invoice.dunning_last_failure_reason ?? ""}`.toLowerCase();
  const isCancelled = paymentRow?.status === "cancelled" || invoice.status === "cancelled" || subscription.status === "cancelled";
  const isFinalized = paymentRow?.status === "paid" || invoice.status === "paid";
  const isExpired = !isCancelled && !isFinalized && (isOrgPlanOneTimeCheckoutExpired(createdAt, now) || failureText.includes("expired"));
  const isPending = !paymentRow || ["created", "processing", "signature_acknowledged"].includes(paymentRow.status);

  if (isFinalized || (isCancelled === false && !isExpired && !isPending)) {
    return null;
  }

  return {
    subscription,
    invoice,
    payment: paymentRow ?? {
      id: invoice.id,
      status: "created",
      created_at: invoice.created_at,
      provider_order_id: invoice.razorpay_order_id,
      provider_payment_id: null,
      failure_reason: invoice.failure_reason,
      amount: invoice.total_amount ?? invoice.subtotal_amount + invoice.tax_amount,
      currency: invoice.currency,
    },
    package: pkg,
    billingCycle: (invoice.billing_cycle ?? subscription.billing_period ?? "monthly") as "monthly" | "annual",
    amountPaise: paymentRow?.amount ?? invoice.total_amount ?? invoice.subtotal_amount + invoice.tax_amount,
    currency: paymentRow?.currency || invoice.currency || "INR",
    orderId,
    createdAt,
    expiresAt,
    isExpired,
    isCancelled,
    isFinalized,
  };
}

function snapshotStateFromDraft(draft: OrgPlanOneTimeCheckoutDraft | null): OrgPlanOneTimeCheckoutState {
  if (!draft) {
    return { hasDraft: false, draft: null, status: "none", message: null };
  }

  if (draft.isCancelled) {
    return { hasDraft: true, draft, status: "cancelled", message: "Payment was cancelled explicitly." };
  }

  if (draft.isExpired) {
    return { hasDraft: true, draft, status: "expired", message: "Pending payment expired after 30 minutes." };
  }

  return { hasDraft: true, draft, status: "pending", message: "Pending payment is available to resume." };
}

async function markOrgPlanOneTimeCheckoutExpired(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  draft: OrgPlanOneTimeCheckoutDraft,
): Promise<void> {
  const now = new Date().toISOString();
  const reason = "Pending payment expired after 30 minutes.";
  const subscriptionPatch: Record<string, unknown> = {
    updated_at: now,
    latest_invoice_id: draft.subscription.latest_invoice_id,
    latest_payment_id: draft.subscription.latest_payment_id,
  };

  if (draft.subscription.status === "pending_activation" || draft.subscription.status === "payment_pending") {
    subscriptionPatch.status = "payment_failed";
  }

  await Promise.all([
    admin.from("org_subscription_payments").update({
      status: "failed",
      failure_reason: reason,
      updated_at: now,
    } as never).eq("id", draft.payment.id),
    admin.from("org_subscription_invoices").update({
      failure_reason: reason,
      dunning_status: "payment_failed",
      dunning_last_failure_reason: reason,
      dunning_next_retry_at: null,
      updated_at: now,
    } as never).eq("id", draft.invoice.id),
    admin.from("organization_subscriptions").update(subscriptionPatch as never).eq("id", draft.subscription.id),
    admin.from("subscription_events").insert({
      organization_id: draft.subscription.organization_id,
      subscription_id: draft.subscription.id,
      event_type: "one_time_payment_expired",
      new_state: {
        invoiceId: draft.invoice.id,
        paymentRecordId: draft.payment.id,
        razorpayOrderId: draft.orderId,
        expiresAt: draft.expiresAt,
      },
      metadata: { source: "checkout_ttl" },
      reason,
      created_at: now,
    } as never),
  ]);
}

async function markOrgPlanOneTimeCheckoutCancelled(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  draft: OrgPlanOneTimeCheckoutDraft,
): Promise<void> {
  const now = new Date().toISOString();
  const reason = "Cancelled by organization owner.";
  const subscriptionPatch: Record<string, unknown> = {
    updated_at: now,
    latest_invoice_id: draft.subscription.latest_invoice_id,
    latest_payment_id: draft.subscription.latest_payment_id,
  };

  if (draft.subscription.status === "pending_activation" || draft.subscription.status === "payment_pending") {
    subscriptionPatch.status = "cancelled";
    subscriptionPatch.cancelled_at = now;
    subscriptionPatch.cancellation_reason = reason;
    subscriptionPatch.cancellation_category = "user_initiated";
  }

  await Promise.all([
    admin.from("org_subscription_payments").update({
      status: "cancelled",
      failure_reason: reason,
      updated_at: now,
    } as never).eq("id", draft.payment.id),
    admin.from("org_subscription_invoices").update({
      status: "cancelled",
      failure_reason: reason,
      dunning_status: "waived",
      dunning_last_failure_reason: reason,
      dunning_next_retry_at: null,
      updated_at: now,
    } as never).eq("id", draft.invoice.id),
    admin.from("organization_subscriptions").update(subscriptionPatch as never).eq("id", draft.subscription.id),
    admin.from("subscription_events").insert({
      organization_id: draft.subscription.organization_id,
      subscription_id: draft.subscription.id,
      event_type: "one_time_payment_cancelled",
      new_state: {
        invoiceId: draft.invoice.id,
        paymentRecordId: draft.payment.id,
        razorpayOrderId: draft.orderId,
      },
      metadata: { source: "checkout_cancel" },
      reason,
      created_at: now,
    } as never),
  ]);
}

function getNextBillingWindow(
  currentExpiry: string | null,
  billingCycle: "monthly" | "annual",
): { startAt: Date; endAt: Date } {
  const now = new Date();
  const currentExpiryDate = currentExpiry ? new Date(currentExpiry) : null;
  const startAt = currentExpiryDate && currentExpiryDate > now ? currentExpiryDate : now;
  const endAt = new Date(startAt);
  endAt.setDate(endAt.getDate() + getDaysForBillingPeriod(billingCycle));
  return { startAt, endAt };
}

async function resolvePricingRow(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  packageId: string,
  billingCycle: "monthly" | "annual",
) {
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

async function getCurrentSubscription(admin: ReturnType<typeof getSupabaseAdminClient>, organizationId: string): Promise<OrgSubscriptionRow | null> {
  const { data } = await admin
    .from("organization_subscriptions")
    .select("id, organization_id, package_id, status, billing_period, billing_engine, auto_renew, started_at, expires_at, next_billing_date, latest_invoice_id, latest_payment_id, provider_subscription_id, provider_plan_id, provider_customer_id, provider_mandate_id, provider_payment_method_id, cancelled_at, cancellation_reason, cancellation_category")
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle() as never as {
    data: OrgSubscriptionRow | null;
    error: { message: string } | null;
  };
  return data ?? null;
}

async function getContactDetails(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, organization: OrgRow) {
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

export async function createOrgPlanOneTimeCheckoutAction(input: OrgPlanOneTimeCheckoutInput): Promise<OrgPlanOneTimeCheckoutResult> {
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

  const organization = await getOrganizationDetails(admin, ctx.organizationId);
  if (!organization) {
    return { success: false, error: "Organization not found." };
  }

  const pkg = await getPackageDetails(admin, input.targetPackageId);
  if (!pkg || !pkg.is_active) {
    return { success: false, error: "Package is not available." };
  }

  const pricing = await resolvePricingRow(admin, input.targetPackageId, input.billingCycle);
  if (!pricing) {
    return { success: false, error: `No pricing found for ${input.billingCycle} billing cycle.` };
  }

  const currentSubscription = await getCurrentSubscription(admin, organization.id);
  const existingSubscriptionId = currentSubscription?.id ?? null;
  const { startAt, endAt } = getNextBillingWindow(currentSubscription?.expires_at ?? null, input.billingCycle);

  const subtotalPaise = pricing.price;
  const currency = pricing.currency || "INR";
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
  const contact = await getContactDetails(supabase, organization);
  const platformCredentials = await resolvePlatformRazorpayCredentials();
  const providerEnvironment = platformCredentials?.environment ?? getRazorpayEnvironment();

  const existingDraft = await loadOrgPlanOneTimeCheckoutDraft(admin, organization.id);
  if (existingDraft) {
    if (existingDraft.isCancelled) {
      // Explictly cancelled transactions are terminal; continue to create a fresh checkout.
    } else if (!existingDraft.isExpired && existingDraft.subscription.package_id === input.targetPackageId && existingDraft.billingCycle === input.billingCycle) {
      billingLogger.info("org-plan-one-time", "Reusing pending checkout", {
        organizationId: organization.id,
        packageId: input.targetPackageId,
        billingCycle: input.billingCycle,
        orderId: existingDraft.orderId,
        invoiceId: existingDraft.invoice.id,
        paymentId: existingDraft.payment.id,
      });

      return {
        success: true,
        provider: "razorpay",
        razorpayKeyId: getRazorpayKeyId(platformCredentials),
        razorpayOrderId: existingDraft.orderId,
        amountPaise: existingDraft.amountPaise,
        subtotalPaise: existingDraft.invoice.subtotal_amount,
        taxPaise: existingDraft.invoice.tax_amount,
        currency: existingDraft.currency,
        invoiceId: existingDraft.invoice.id,
        paymentRecordId: existingDraft.payment.id,
        subscriptionId: existingDraft.subscription.id,
        packageDisplayName: existingDraft.package?.name ?? pkg.name,
        organizationDisplayName: organization.name ?? "",
        billingCycle: existingDraft.billingCycle,
        isTestMode: providerEnvironment === "test",
        environmentLabel: providerEnvironment === "test" ? "Test Mode" : "Live Mode",
        checkoutState: snapshotStateFromDraft(existingDraft),
      };
    } else if (existingDraft.isExpired) {
      await markOrgPlanOneTimeCheckoutExpired(admin, existingDraft);
    } else {
      return {
        success: false,
        error: "You already have a pending payment for another plan. Resume or cancel it first.",
      };
    }
  }

  if (platformCredentials) {
    const authCheck = await preflightRazorpayCredentials(platformCredentials);
    if (!authCheck.ok) {
      billingLogger.error("org-plan-one-time", "Razorpay auth preflight failed", {
        organizationId: organization.id,
        packageId: pkg.id,
        billingCycle: input.billingCycle,
        error: authCheck.message,
      });
      return { success: false, error: authCheck.message };
    }
  }

  const orderResult = await createRazorpayOrder({
    amountInRupees: toRupees(totalAmountPaise),
    currency,
    receipt: buildInvoiceNumber("ORG-PLAN"),
    notes: {
      organization_id: organization.id,
      organization_name: organization.name,
      package_id: pkg.id,
      package_name: pkg.name,
      billing_period: input.billingCycle,
      billing_engine: "invoice",
      source: "org_plan_one_time",
      customer_name: contact.name,
      customer_email: contact.email,
    },
  }, platformCredentials);

  if (!orderResult.ok) {
    billingLogger.error("org-plan-one-time", "Razorpay order creation failed", {
      organizationId: organization.id,
      packageId: pkg.id,
      billingCycle: input.billingCycle,
      error: orderResult.message,
    });
    return { success: false, error: orderResult.message };
  }

  const orderId = orderResult.data.id;
  const invoiceNumber = buildInvoiceNumber("ORG-PLAN");
  const paymentNumber = buildPaymentNumber("ORG-PLAN-PAY");

  let subscriptionId = existingSubscriptionId;
  if (!subscriptionId) {
    const { data: createdSubscription, error: createSubscriptionError } = await admin
      .from("organization_subscriptions")
      .insert({
        organization_id: organization.id,
        package_id: pkg.id,
        status: "pending_activation",
        billing_period: input.billingCycle,
        billing_engine: "invoice",
        started_at: startAt.toISOString(),
        expires_at: endAt.toISOString(),
        next_billing_date: endAt.toISOString(),
        auto_renew: false,
        provider: "razorpay",
        provider_environment: providerEnvironment,
        provider_subscription_id: null,
        provider_plan_id: null,
        provider_customer_id: null,
        provider_mandate_id: null,
        provider_payment_method_id: null,
        latest_invoice_id: null,
        latest_payment_id: null,
        updated_at: new Date().toISOString(),
      } as never)
      .select("id")
      .maybeSingle() as never as {
      data: { id: string } | null;
      error: { message: string } | null;
    };

    if (createSubscriptionError || !createdSubscription) {
      return { success: false, error: createSubscriptionError?.message ?? "Failed to create subscription record." };
    }

    subscriptionId = createdSubscription.id;
  }

  const { data: invoice, error: invoiceError } = await admin
    .from("org_subscription_invoices")
    .upsert({
      organization_id: organization.id,
      subscription_id: subscriptionId,
      package_id: pkg.id,
      payment_method_id: null,
      provider: "razorpay",
      provider_environment: providerEnvironment,
      provider_subscription_id: null,
      invoice_number: invoiceNumber,
      status: "issued",
      currency,
      subtotal_amount: subtotalPaise,
      discount_amount: 0,
      tax_amount: taxPaise,
      amount_paid: 0,
      billing_period_start: startAt.toISOString().slice(0, 10),
      billing_period_end: endAt.toISOString().slice(0, 10),
      billing_cycle: input.billingCycle,
      issued_at: new Date().toISOString(),
      due_at: new Date().toISOString(),
      razorpay_order_id: orderId,
      idempotency_key: buildOrgPlanOneTimeInvoiceIdempotencyKey(
        subscriptionId,
        input.billingCycle,
        startAt.toISOString().slice(0, 10),
        endAt.toISOString().slice(0, 10),
      ),
    } as never, {
      onConflict: "subscription_id,billing_period_start,billing_period_end",
    })
    .select("id")
    .maybeSingle() as never as {
    data: InvoiceRow | null;
    error: { message: string } | null;
  };

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message ?? "Failed to create organization invoice." };
  }

  const { data: payment, error: paymentError } = await admin
    .from("org_subscription_payments")
    .upsert({
      organization_id: organization.id,
      subscription_id: subscriptionId,
      invoice_id: invoice.id,
      payment_number: paymentNumber,
      status: "processing",
      provider: "razorpay",
      provider_environment: providerEnvironment,
      provider_order_id: orderId,
      provider_payment_id: null,
      amount: totalAmountPaise,
      currency,
      payment_method_id: null,
      provider_signature_verified: false,
      idempotency_key: buildOrgPlanOneTimePaymentIdempotencyKey(
        subscriptionId,
        input.billingCycle,
        startAt.toISOString().slice(0, 10),
        endAt.toISOString().slice(0, 10),
      ),
    } as never, {
      onConflict: "idempotency_key",
    })
    .select("id")
    .maybeSingle() as never as {
    data: PaymentRow | null;
    error: { message: string } | null;
  };

  if (paymentError || !payment) {
    return { success: false, error: paymentError?.message ?? "Failed to create organization payment." };
  }

  await admin.from("organization_subscriptions").update({
    latest_invoice_id: invoice.id,
    latest_payment_id: payment.id,
    updated_at: new Date().toISOString(),
  } as never).eq("id", subscriptionId);

  await admin.from("subscription_events").insert({
    organization_id: organization.id,
    subscription_id: subscriptionId,
    event_type: "one_time_payment_created",
    new_state: {
      razorpayOrderId: orderId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      amount: totalAmountPaise,
      billingCycle: input.billingCycle,
    },
    metadata: {
      source: "org_plan_one_time",
      providerEnvironment,
      packageId: pkg.id,
    },
    reason: `One-time Razorpay invoice ${invoiceNumber} created for ${pkg.name} (${input.billingCycle})`,
    created_at: new Date().toISOString(),
  } as never);

  billingLogger.info("org-plan-one-time", "Checkout created", {
    organizationId: organization.id,
    packageId: pkg.id,
    billingCycle: input.billingCycle,
    orderId,
    invoiceId: invoice.id,
    paymentId: payment.id,
  });

  const checkoutCreatedAt = new Date().toISOString();
  return {
    success: true,
    provider: "razorpay",
    razorpayKeyId: getRazorpayKeyId(platformCredentials),
    razorpayOrderId: orderId,
    amountPaise: totalAmountPaise,
    subtotalPaise,
    taxPaise,
    currency,
    invoiceId: invoice.id,
    paymentRecordId: payment.id,
    subscriptionId,
    packageDisplayName: pkg.name,
    organizationDisplayName: organization.name ?? "",
    billingCycle: input.billingCycle,
    isTestMode: providerEnvironment === "test",
    environmentLabel: providerEnvironment === "test" ? "Test Mode" : "Live Mode",
    checkoutState: {
      hasDraft: true,
      draft: {
        subscription: {
          id: subscriptionId,
          organization_id: organization.id,
          package_id: pkg.id,
          status: currentSubscription?.status ?? "pending_activation",
          billing_period: input.billingCycle,
          billing_engine: "invoice",
          auto_renew: false,
          started_at: currentSubscription?.started_at ?? checkoutCreatedAt,
          expires_at: currentSubscription?.expires_at ?? endAt.toISOString(),
          next_billing_date: currentSubscription?.next_billing_date ?? endAt.toISOString(),
          latest_invoice_id: invoice.id,
          latest_payment_id: payment.id,
          provider_subscription_id: null,
          provider_plan_id: null,
          provider_customer_id: null,
          provider_mandate_id: null,
          provider_payment_method_id: null,
          cancelled_at: currentSubscription?.cancelled_at ?? null,
          cancellation_reason: currentSubscription?.cancellation_reason ?? null,
          cancellation_category: currentSubscription?.cancellation_category ?? null,
        },
        invoice: {
          id: invoice.id,
          invoice_number: invoiceNumber,
          status: "issued",
          billing_cycle: input.billingCycle,
          created_at: checkoutCreatedAt,
          failure_reason: null,
          dunning_status: null,
          dunning_last_failure_reason: null,
          razorpay_order_id: orderId,
          provider_environment: providerEnvironment,
          total_amount: totalAmountPaise,
          subtotal_amount: subtotalPaise,
          tax_amount: taxPaise,
          currency,
        },
        payment: {
          id: payment.id,
          status: "processing",
          created_at: checkoutCreatedAt,
          provider_order_id: orderId,
          provider_payment_id: null,
          failure_reason: null,
          amount: totalAmountPaise,
          currency,
        },
        package: { id: pkg.id, name: pkg.name, is_active: pkg.is_active },
        billingCycle: input.billingCycle,
        amountPaise: totalAmountPaise,
        currency,
        orderId,
        createdAt: checkoutCreatedAt,
        expiresAt: getOrgPlanOneTimeCheckoutExpiresAt(checkoutCreatedAt).toISOString(),
        isExpired: false,
        isCancelled: false,
        isFinalized: false,
      },
      status: "pending",
      message: "Pending payment is available to resume.",
    },
  };
}

export async function finalizeOrgPlanOneTimePaymentAction(input: OrgPlanOneTimeFinalizeInput): Promise<OrgPlanOneTimeFinalizeResult> {
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
  const isValid = verifyRazorpayPaymentSignature({
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
    credentials: platformCredentials,
  });

  if (!isValid) {
    return { success: false, error: "Razorpay payment signature verification failed." };
  }

  const { data: invoice } = await admin
    .from("org_subscription_invoices")
    .select("*")
    .eq("id", input.invoiceId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle() as never as {
    data: { id: string; subscription_id: string; package_id: string; status: string; total_amount: number; subtotal_amount: number; billing_cycle: string | null; paid_at: string | null } | null;
    error: { message: string } | null;
  };

  if (!invoice) {
    return { success: false, error: "Invoice not found." };
  }

  if (invoice.status === "paid" || invoice.paid_at) {
    return { success: true, status: "already_processed", invoiceId: invoice.id, paymentRecordId: input.paymentRecordId, subscriptionId: invoice.subscription_id };
  }

  const { data: payment } = await admin
    .from("org_subscription_payments")
    .select("*")
    .eq("id", input.paymentRecordId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle() as never as {
    data: { id: string; subscription_id: string; invoice_id: string; status: string; amount: number; currency: string; provider_order_id: string | null; provider_payment_id: string | null } | null;
    error: { message: string } | null;
  };

  if (!payment) {
    return { success: false, error: "Payment record not found." };
  }

  if (invoice.status === "cancelled" || payment.status === "cancelled") {
    return { success: false, error: "This payment was cancelled explicitly." };
  }

  const razorpayPayment = await fetchRazorpayPayment(input.razorpayPaymentId, platformCredentials);
  if (!razorpayPayment.ok) {
    return { success: false, error: razorpayPayment.message };
  }

  const payload = razorpayPayment.payment as Record<string, unknown>;
  const captured = payload.captured === true || payload.status === "captured";
  if (String(payload.order_id ?? "") !== input.razorpayOrderId) {
    return { success: false, error: "Razorpay order mismatch." };
  }
  if (!captured) {
    return { success: false, error: "Payment is not captured yet." };
  }

  const now = new Date();
  const currentSubscription = await getCurrentSubscription(admin, ctx.organizationId);
  const { endAt } = getNextBillingWindow(currentSubscription?.expires_at ?? null, (invoice.billing_cycle as "monthly" | "annual") ?? "monthly");
  const packageDetails = await getPackageDetails(admin, invoice.package_id);

  await admin.from("org_subscription_invoices").update({
    status: "paid",
    amount_paid: invoice.total_amount,
    razorpay_payment_id: input.razorpayPaymentId,
    paid_at: now.toISOString(),
  } as never).eq("id", invoice.id);

  await admin.from("org_subscription_payments").update({
    status: "paid",
    provider_payment_id: input.razorpayPaymentId,
    provider_signature_verified: true,
    paid_at: now.toISOString(),
    updated_at: now.toISOString(),
  } as never).eq("id", payment.id);

  await admin.from("organization_subscriptions").update({
    package_id: invoice.package_id,
    status: "active",
    billing_period: invoice.billing_cycle ?? currentSubscription?.billing_period ?? "monthly",
    billing_engine: "invoice",
    started_at: currentSubscription?.started_at ?? now.toISOString(),
    expires_at: endAt.toISOString(),
    next_billing_date: endAt.toISOString(),
    auto_renew: false,
    provider: "razorpay",
    provider_environment: platformCredentials?.environment ?? getRazorpayEnvironment(),
    provider_subscription_id: null,
    provider_plan_id: null,
    provider_customer_id: null,
    provider_mandate_id: null,
    provider_payment_method_id: null,
    latest_invoice_id: invoice.id,
    latest_payment_id: payment.id,
    cancelled_at: null,
    cancellation_reason: null,
    cancellation_category: null,
    updated_at: now.toISOString(),
  } as never).eq("id", invoice.subscription_id);

  await admin.from("subscription_events").insert({
    organization_id: ctx.organizationId,
    subscription_id: invoice.subscription_id,
    event_type: "one_time_payment_captured",
    actor_id: user.id,
    new_state: {
      invoiceId: invoice.id,
      paymentRecordId: payment.id,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpayOrderId: input.razorpayOrderId,
      amount: invoice.total_amount,
      nextBillingDate: endAt.toISOString(),
      billingMode: "invoice",
    },
    metadata: {
      source: "checkout_callback",
      providerEnvironment: platformCredentials?.environment ?? getRazorpayEnvironment(),
    },
    reason: `Razorpay one-time plan payment captured for ${packageDetails?.name ?? "plan"}.`,
    created_at: now.toISOString(),
  } as never);

  await syncSubscriptionArtifactsForOrganization(
    ctx.organizationId,
    "Organization one-time plan payment captured.",
  );

  await writeAuditLog({
    actorId: ctx.userId,
    action: "organization_owner.one_time_plan_payment_captured",
    entityType: "organization_subscription",
    entityId: invoice.subscription_id,
    metadata: {
      invoiceId: invoice.id,
      paymentId: payment.id,
      razorpayOrderId: input.razorpayOrderId,
      billingMode: "invoice",
      amount: invoice.total_amount,
    } as never,
  });

  billingLogger.info("org-plan-one-time", "Payment confirmed", {
    organizationId: ctx.organizationId,
    subscriptionId: invoice.subscription_id,
    invoiceId: invoice.id,
    paymentId: payment.id,
  });

  revalidatePath("/organization");
  revalidatePath("/organization/plan");

  return {
    success: true,
    status: "payment_confirmed",
    invoiceId: invoice.id,
    paymentRecordId: payment.id,
    subscriptionId: invoice.subscription_id,
  };
}

export async function getOrgPlanOneTimeCheckoutStateAction(): Promise<OrgPlanOneTimeCheckoutState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { hasDraft: false, draft: null, status: "none", message: null };
  }

  const ctx = await requireOrganizationOwner("/organization/plan");
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { hasDraft: false, draft: null, status: "none", message: "Database connection failed." };
  }

  const draft = await loadOrgPlanOneTimeCheckoutDraft(admin, ctx.organizationId);
  if (!draft) {
    return { hasDraft: false, draft: null, status: "none", message: null };
  }

  if (draft.isExpired) {
    await markOrgPlanOneTimeCheckoutExpired(admin, draft);
    return snapshotStateFromDraft({ ...draft, isExpired: true });
  }

  return snapshotStateFromDraft(draft);
}

export async function cancelOrgPlanOneTimeCheckoutAction(): Promise<
  { success: true; checkoutState: OrgPlanOneTimeCheckoutState }
  | { success: false; error: string }
> {
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

  const draft = await loadOrgPlanOneTimeCheckoutDraft(admin, ctx.organizationId);
  if (!draft) {
    return { success: false, error: "No pending payment found to cancel." };
  }

  if (draft.isCancelled) {
    return { success: false, error: "This payment was already cancelled." };
  }

  if (draft.isExpired) {
    return { success: false, error: "This payment already expired." };
  }

  await markOrgPlanOneTimeCheckoutCancelled(admin, draft);

  await writeAuditLog({
    actorId: ctx.userId,
    action: "organization_owner.one_time_plan_payment_cancelled",
    entityType: "organization_subscription",
    entityId: draft.subscription.id,
    metadata: {
      invoiceId: draft.invoice.id,
      paymentId: draft.payment.id,
      razorpayOrderId: draft.orderId,
    } as never,
  });

  billingLogger.info("org-plan-one-time", "Checkout cancelled", {
    organizationId: ctx.organizationId,
    subscriptionId: draft.subscription.id,
    invoiceId: draft.invoice.id,
    paymentId: draft.payment.id,
    orderId: draft.orderId,
  });

  return { success: true, checkoutState: snapshotStateFromDraft({ ...draft, isCancelled: true }) };
}
