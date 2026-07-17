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
        status: "pending",
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
    .insert({
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
      total_amount: totalAmountPaise,
      amount_paid: 0,
      billing_period_start: startAt.toISOString().slice(0, 10),
      billing_period_end: endAt.toISOString().slice(0, 10),
      billing_cycle: input.billingCycle,
      issued_at: new Date().toISOString(),
      due_at: new Date().toISOString(),
      razorpay_order_id: orderId,
      idempotency_key: `org_plan_${organization.id}_${orderId}`,
    } as never)
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
    .insert({
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
      idempotency_key: `org_plan_${organization.id}_${orderId}`,
    } as never)
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
