"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRazorpayPublicKeyId, getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";
import { createRazorpayOrder } from "@/features/billing/razorpay/razorpay-service";
import { calculateTax } from "@/features/billing/services/tax-service";
import type {
  SecureCheckoutIntentInput,
  SecureCheckoutIntentResult,
} from "@/features/billing/razorpay/razorpay-types";

const SUBSCRIPTION_MANAGER_ROLES = new Set(["organization_owner", "owner", "admin", "manager", "gym_admin"]);

type DbError = { message: string } | null;
type UnknownRow = Record<string, unknown>;
type SelectQuery = {
  eq(column: string, value: unknown): SelectQuery;
  in(column: string, values: string[]): SelectQuery;
  order(column: string, options: { ascending: boolean }): SelectQuery;
  limit(count: number): Promise<{ data: UnknownRow[] | null; error: DbError }>;
  maybeSingle(): Promise<{ data: UnknownRow | null; error: DbError }>;
};
type InsertQuery = {
  select(columns: string): {
    maybeSingle(): Promise<{ data: UnknownRow | null; error: DbError }>;
  };
};
type CheckoutDb = {
  from(table: string): {
    select(columns: string): SelectQuery;
    insert(row: UnknownRow): InsertQuery;
  };
  rpc(
    name: "attach_razorpay_subscription_order",
    args: {
      p_invoice_id: string;
      p_organization_id: string;
      p_subscription_id: string | null;
      p_provider_environment: string;
      p_provider_order_id: string;
      p_amount: number;
      p_currency: string;
      p_idempotency_key: string;
      p_payment_number: string;
      p_actor_id: string;
      p_package_name: string;
      p_billing_cycle: string;
    },
  ): Promise<{ data: unknown; error: DbError }>;
};
type AttachOrderPayload = {
  success?: boolean;
  error?: string;
  code?: string;
};

function canManageSubscription(role: string | null | undefined, ownerUserId: string | null | undefined, userId: string): boolean {
  return ownerUserId === userId || (role ? SUBSCRIPTION_MANAGER_ROLES.has(role) : false);
}

function readAttachPayload(value: unknown): AttachOrderPayload {
  return value && typeof value === "object" ? value as AttachOrderPayload : {};
}

export async function createSecureSubscriptionCheckoutOrderAction(
  input: SecureCheckoutIntentInput,
): Promise<SecureCheckoutIntentResult> {
  try {
    const { targetPackageId, billingCycle, startMode } = input;
    const providerEnvironment = getRazorpayEnvironment();

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

    if (!profile) {
      return { success: false, error: "User profile not found." };
    }

    const organizationId = profile.organization_id;
    if (!organizationId) {
      return { success: false, error: "User is not associated with an organization." };
    }

    const { data: organization } = await supabase
      .from("organizations")
      .select("id, name, owner_user_id")
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
      return { success: false, error: "You do not have permission to manage subscriptions." };
    }

    const { data: pkg } = await supabase
      .from("packages")
      .select("id, name, is_active")
      .eq("id", targetPackageId)
      .maybeSingle();

    if (!pkg) {
      return { success: false, error: "Package not found." };
    }
    if (!pkg.is_active) {
      return { success: false, error: "Package is not active." };
    }

    const adminDbClient = getSupabaseAdminClient();
    if (!adminDbClient) {
      return { success: false, error: "Database connection failed." };
    }
    const d = adminDbClient as unknown as CheckoutDb;

    const readDb = supabase as unknown as CheckoutDb;
    const { data: pricingRows } = await readDb
      .from("package_pricing")
      .select("*")
      .eq("package_id", targetPackageId)
      .eq("billing_period", billingCycle)
      .limit(1);

    const pricing = (pricingRows ?? [])[0];
    if (!pricing) {
      return { success: false, error: `No pricing found for ${billingCycle} billing cycle.` };
    }

    let subtotalPaise = typeof pricing.price === "number" ? pricing.price : 0;
    const currency = typeof pricing.currency === "string" && pricing.currency ? pricing.currency : "INR";

    const { data: currentSubscriptions } = await d
      .from("organization_subscriptions")
      .select("id, status, package_id, price_override, billing_period, expires_at, cancelled_at")
      .eq("organization_id", organizationId)
      .in("status", ["active", "trial", "cancelled", "expired", "suspended"])
      .order("started_at", { ascending: false })
      .limit(1);

    const currentSubscription = (currentSubscriptions ?? [])[0];
    const currentStatus = currentSubscription?.status as string | undefined;
    const currentSubId = currentSubscription?.id as string | undefined;

    if (currentStatus === "active" || currentStatus === "trial") {
      return { success: false, error: "You already have an active plan. Please cancel the current plan before purchasing a new one." };
    }

    if (currentStatus === "cancelled" && startMode === "now" && currentSubId) {
      // Remove cancelled subscription so new one can be created (unique constraint on org_id)
      await (adminDbClient as any).from("organization_subscriptions").delete().eq("id", currentSubId);
    }

    if (typeof currentSubscription?.price_override === "number") {
      subtotalPaise = currentSubscription.price_override;
    }

    if (subtotalPaise <= 0) {
      return { success: false, error: "Invalid price." };
    }

    let taxAmountPaise = 0;
    try {
      const tax = await calculateTax({ subtotal: subtotalPaise, organizationId });
      taxAmountPaise = tax.totalTax;
    } catch {
      // tax service unavailable
    }

    const totalAmountPaise = subtotalPaise + taxAmountPaise;

    const periodStart = new Date().toISOString().slice(0, 10);
    const daysMap: Record<string, number> = { monthly: 30, annual: 365 };
    const periodEnd = new Date(Date.now() + (daysMap[billingCycle] || 30) * 86400000).toISOString().slice(0, 10);
    const idempotencyKey = `sub_${providerEnvironment}_${organizationId}_${targetPackageId}_${billingCycle}_${periodStart}`;

    const { data: existingInvs } = await d
      .from("org_subscription_invoices")
      .select("id, razorpay_order_id, status, total_amount, currency, organization_id, package_id, provider_environment")
      .eq("idempotency_key", idempotencyKey)
      .eq("provider_environment", providerEnvironment)
      .limit(1);

    const existingInv = (existingInvs ?? [])[0];

    let invoiceId: string | undefined;
    let existingOrderId: string | null = null;

    if (existingInv) {
      invoiceId = String(existingInv.id);
      if (typeof existingInv.razorpay_order_id === "string" && existingInv.razorpay_order_id && existingInv.status !== "cancelled") {
        existingOrderId = existingInv.razorpay_order_id;
        const existingAmountPaise = typeof existingInv.total_amount === "number" ? existingInv.total_amount : totalAmountPaise;
        const attach = await attachSubscriptionOrder(d, {
          invoiceId: invoiceId!,
          organizationId,
          subscriptionId: currentSubId ?? null,
          providerEnvironment,
          providerOrderId: existingOrderId,
          amount: existingAmountPaise,
          currency: typeof existingInv.currency === "string" ? existingInv.currency : currency,
          idempotencyKey,
          actorId: user.id,
          packageName: pkg.name as string,
          billingCycle,
        });
        if (!attach.success) {
          return attach;
        }
        return {
          success: true,
          razorpayKeyId: getRazorpayPublicKeyId(),
          razorpayOrderId: existingOrderId,
          amountPaise: existingAmountPaise,
          subtotalPaise,
          taxPaise: taxAmountPaise,
          currency: typeof existingInv.currency === "string" ? existingInv.currency : currency,
          invoiceId: invoiceId!,
          packageDisplayName: pkg.name as string,
          organizationDisplayName: organization.name ?? "",
          billingCycle,
          isTestMode: providerEnvironment === "test",
          environmentLabel: providerEnvironment === "test" ? "Test Mode" : "Live",
        };
      }
    }

    if (!invoiceId) {
      const invoicePayload: Record<string, unknown> = {
        organization_id: organizationId,
        subscription_id: currentSubId ?? null,
        invoice_number: `SUB-${organizationId.slice(0, 8)}-${String(Date.now()).slice(-6)}`,
        status: "draft",
        currency,
        subtotal_amount: subtotalPaise,
        tax_amount: taxAmountPaise,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        billing_cycle: billingCycle,
        provider: "razorpay",
        provider_environment: providerEnvironment,
        idempotency_key: idempotencyKey,
        package_id: targetPackageId,
        due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        issued_at: new Date().toISOString(),
      };

      const { data: inv, error: invoiceError } = await d
        .from("org_subscription_invoices")
        .insert(invoicePayload)
        .select("id")
        .maybeSingle();

      if (invoiceError || !inv) {
        return { success: false, error: invoiceError?.message ?? "Failed to create invoice." };
      }
      invoiceId = String(inv.id);
    }

    const receipt = `SUB-${organizationId.slice(0, 8)}-${String(Date.now()).slice(-6)}`;
    const amountInRupees = totalAmountPaise / 100;

    const orderResult = await createRazorpayOrder({
      amountInRupees,
      currency,
      receipt,
      notes: {
        organization_id: organizationId,
        package_id: targetPackageId,
        invoice_id: invoiceId!,
        billing_cycle: billingCycle,
        environment: providerEnvironment,
      },
      idempotencyKey,
    });

    if (!orderResult.ok) {
      return { success: false, error: orderResult.message };
    }

    const order = orderResult.data;

    const attach = await attachSubscriptionOrder(d, {
      invoiceId: invoiceId!,
      organizationId,
      subscriptionId: currentSubId ?? null,
      providerEnvironment,
      providerOrderId: order.id,
      amount: totalAmountPaise,
      currency,
      idempotencyKey,
      actorId: user.id,
      packageName: pkg.name as string,
      billingCycle,
    });
    if (!attach.success) {
      return attach;
    }

    return {
      success: true,
      razorpayKeyId: getRazorpayPublicKeyId(),
      razorpayOrderId: order.id,
      amountPaise: totalAmountPaise,
      subtotalPaise,
      taxPaise: taxAmountPaise,
      currency,
      invoiceId: invoiceId!,
      packageDisplayName: pkg.name,
      organizationDisplayName: organization.name ?? "",
      billingCycle,
      isTestMode: providerEnvironment === "test",
      environmentLabel: providerEnvironment === "test" ? "Test Mode" : "Live",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}

async function attachSubscriptionOrder(
  db: CheckoutDb,
  input: {
    invoiceId: string;
    organizationId: string;
    subscriptionId: string | null;
    providerEnvironment: string;
    providerOrderId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
    actorId: string;
    packageName: string;
    billingCycle: string;
  },
): Promise<{ success: true } | { success: false; error: string }> {
  const { data, error } = await db.rpc("attach_razorpay_subscription_order", {
    p_invoice_id: input.invoiceId,
    p_organization_id: input.organizationId,
    p_subscription_id: input.subscriptionId,
    p_provider_environment: input.providerEnvironment,
    p_provider_order_id: input.providerOrderId,
    p_amount: input.amount,
    p_currency: input.currency,
    p_idempotency_key: input.idempotencyKey,
    p_payment_number: `PAY-${input.organizationId.slice(0, 8)}-${String(Date.now()).slice(-6)}`,
    p_actor_id: input.actorId,
    p_package_name: input.packageName,
    p_billing_cycle: input.billingCycle,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const payload = readAttachPayload(data);
  if (!payload.success) {
    return { success: false, error: payload.error ?? "Failed to attach Razorpay order." };
  }

  return { success: true };
}
