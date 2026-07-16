"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/api-guards";
import { createRazorpayOrder } from "@/features/billing/razorpay/razorpay-service";
import { getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";
import { resolvePlatformRazorpayCredentials } from "@/features/billing/razorpay/platform-razorpay-config";
import type { AuthActionState } from "@/features/auth/actions/action-state";

const DUNNING_POLICY = {
  maxRetryAttempts: 3,
  retryIntervalDays: 3,
  gracePeriodDays: 7,
  autoSuspend: false,
  remindersEnabled: false,
};

const superAdminRoles = ["super_admin"] as const;

function revalidatePaths() {
  revalidatePath("/super-admin/subscriptions");
  revalidatePath("/organization/plan");
}

export async function retrySubscriptionPaymentAction(input: {
  invoiceId: string; subscriptionId: string; organizationId: string;
}): Promise<AuthActionState> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    const db = getSupabaseAdminClient() as any;
    if (!db) return { status: "error", message: "Database connection failed." };

    const credentials = await resolvePlatformRazorpayCredentials();
    const providerEnvironment = credentials?.environment ?? getRazorpayEnvironment();

    const { data: invoice } = await db.from("org_subscription_invoices").select("*").eq("id", input.invoiceId).maybeSingle();
    if (!invoice) return { status: "error", message: "Invoice not found." };
    if (invoice.status === "paid") return { status: "success", message: "Invoice is already paid." };

    const amount = invoice.total_amount || invoice.subtotal_amount || 0;
    if (amount <= 0) return { status: "error", message: "Invoice amount is invalid." };

    // Check if there's a valid existing Razorpay order
    if (invoice.razorpay_order_id) {
      return { status: "error", message: "An order already exists for this invoice. Use the existing checkout flow." };
    }

    const receipt = `RETRY-${input.organizationId.slice(0, 8)}-${String(Date.now()).slice(-6)}`;
    const orderResult = await createRazorpayOrder({
      amountInRupees: amount / 100,
      currency: invoice.currency || "INR",
      receipt,
      notes: {
        organization_id: input.organizationId,
        invoice_id: input.invoiceId,
        subscription_id: input.subscriptionId,
        type: "dunning_retry",
        environment: providerEnvironment,
      },
    }, credentials);

    if (!orderResult.ok) return { status: "error", message: orderResult.message };

    // Update invoice with new order
    await db.from("org_subscription_invoices").update({
      razorpay_order_id: orderResult.data.id,
      dunning_status: "retry_scheduled",
      dunning_attempts: (invoice.dunning_attempts || 0) + 1,
      dunning_next_retry_at: new Date(Date.now() + DUNNING_POLICY.retryIntervalDays * 86400000).toISOString(),
      status: "pending",
    }).eq("id", input.invoiceId);

    // Update subscription dunning fields
    await db.from("organization_subscriptions").update({
      dunning_attempts: (invoice.dunning_attempts || 0) + 1,
      dunning_next_retry: new Date(Date.now() + DUNNING_POLICY.retryIntervalDays * 86400000).toISOString(),
    }).eq("id", input.subscriptionId);

    // Record audit event
    await db.from("subscription_events").insert({
      organization_id: input.organizationId,
      subscription_id: input.subscriptionId,
      event_type: "payment_retry_order_created",
      actor_id: auth.context.userId,
      new_state: { invoiceId: input.invoiceId, orderId: orderResult.data.id, amount },
      reason: `Retry payment: new Razorpay order ${orderResult.data.id}`,
      created_at: new Date().toISOString(),
    });

    revalidatePaths();
    return { status: "success", message: `Retry order created: ${orderResult.data.id}` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Retry failed." };
  }
}

export async function extendGracePeriodAction(input: {
  subscriptionId: string; invoiceId: string; organizationId: string;
  newGraceEndDate: string; reason: string;
}): Promise<AuthActionState> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    const db = getSupabaseAdminClient() as any;
    if (!db) return { status: "error", message: "Database connection failed." };

    await db.from("org_subscription_invoices").update({
      dunning_status: "grace_period",
      dunning_grace_period_ends_at: input.newGraceEndDate,
    }).eq("id", input.invoiceId);

    await db.from("subscription_events").insert({
      organization_id: input.organizationId,
      subscription_id: input.subscriptionId,
      event_type: "grace_period_extended",
      actor_id: auth.context.userId,
      new_state: { invoiceId: input.invoiceId, graceEnd: input.newGraceEndDate },
      reason: input.reason,
      created_at: new Date().toISOString(),
    });

    revalidatePaths();
    return { status: "success", message: "Grace period extended." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to extend grace period." };
  }
}

export async function suspendSubscriptionForNonPaymentAction(input: {
  subscriptionId: string; invoiceId: string; organizationId: string; reason: string;
}): Promise<AuthActionState> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    const db = getSupabaseAdminClient() as any;
    if (!db) return { status: "error", message: "Database connection failed." };

    const { data: currentSub } = await db.from("organization_subscriptions").select("dunning_attempts").eq("id", input.subscriptionId).maybeSingle();
    const currentAttempts = (currentSub?.dunning_attempts as number ?? 0) + 1;

    await db.from("organization_subscriptions").update({
      status: "suspended",
      dunning_attempts: currentAttempts,
    }).eq("id", input.subscriptionId);

    await db.from("org_subscription_invoices").update({
      dunning_status: "suspended",
    }).eq("id", input.invoiceId);

    await db.from("subscription_events").insert({
      organization_id: input.organizationId,
      subscription_id: input.subscriptionId,
      event_type: "subscription_suspended_for_non_payment",
      actor_id: auth.context.userId,
      new_state: { invoiceId: input.invoiceId },
      reason: input.reason,
      created_at: new Date().toISOString(),
    });

    revalidatePaths();
    return { status: "success", message: "Subscription suspended for non-payment." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Suspension failed." };
  }
}

export async function reactivateAfterPaymentAction(input: {
  subscriptionId: string; invoiceId: string; organizationId: string; reason: string;
}): Promise<AuthActionState> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    const db = getSupabaseAdminClient() as any;
    if (!db) return { status: "error", message: "Database connection failed." };

    await db.from("organization_subscriptions").update({
      status: "active",
      dunning_attempts: 0,
      dunning_next_retry: null,
    }).eq("id", input.subscriptionId);

    await db.from("org_subscription_invoices").update({
      dunning_status: "resolved",
    }).eq("id", input.invoiceId);

    await db.from("subscription_events").insert({
      organization_id: input.organizationId,
      subscription_id: input.subscriptionId,
      event_type: "dunning_resolved",
      actor_id: auth.context.userId,
      new_state: { invoiceId: input.invoiceId, status: "resolved" },
      reason: input.reason,
      created_at: new Date().toISOString(),
    });

    revalidatePaths();
    return { status: "success", message: "Subscription reactivated." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Reactivation failed." };
  }
}
