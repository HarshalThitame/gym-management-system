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

export async function createSecureSubscriptionCheckoutOrderAction(
  input: SecureCheckoutIntentInput,
): Promise<SecureCheckoutIntentResult> {
  try {
    const { targetPackageId, billingCycle, upgradeRequestId } = input;

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

    const { data: branchUser } = await supabase
      .from("branch_users")
      .select("role_name")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    const role = branchUser?.role_name;
    if (role === "member" || role === "reception_staff" || role === "trainer") {
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

    const { data: pricingRows } = await (supabase as any)
      .from("package_pricing")
      .select("*")
      .eq("package_id", targetPackageId)
      .eq("billing_period", billingCycle);

    const pricing = (pricingRows ?? [])[0];
    if (!pricing) {
      return { success: false, error: `No pricing found for ${billingCycle} billing cycle.` };
    }

    let subtotalPaise = pricing.price as number;
    const currency = (pricing.currency as string) || "INR";

    const { data: currentSubscription } = await (supabase as any)
      .from("organization_subscriptions")
      .select("id, status, package_id, price_override, billing_period")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const currentSubId = currentSubscription?.id;

    if (currentSubscription?.price_override != null) {
      subtotalPaise = currentSubscription.price_override as number;
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
    const idempotencyKey = `sub_${organizationId}_${targetPackageId}_${billingCycle}_${periodStart}`;

    const adminDbClient = getSupabaseAdminClient();
    if (!adminDbClient) {
      return { success: false, error: "Database connection failed." };
    }
    const d = adminDbClient as any;

    const { data: existingInvs } = await d
      .from("org_subscription_invoices")
      .select("id, razorpay_order_id, status, total_amount")
      .eq("idempotency_key", idempotencyKey);

    const existingInv = (existingInvs ?? [])[0];

    let invoiceId: string;
    let existingOrderId: string | null = null;

    if (existingInv) {
      invoiceId = existingInv.id;
      if (existingInv.razorpay_order_id && existingInv.status !== "cancelled") {
        existingOrderId = existingInv.razorpay_order_id;
        return {
          success: true,
          razorpayKeyId: getRazorpayPublicKeyId(),
          razorpayOrderId: existingOrderId!,
          amountPaise: totalAmountPaise,
          currency,
          invoiceId,
          packageDisplayName: pkg.name,
          organizationDisplayName: "",
          billingCycle,
          isTestMode: getRazorpayEnvironment() === "test",
          environmentLabel: getRazorpayEnvironment() === "test" ? "Test Mode" : "Live",
        };
      }
    } else {
      const invoicePayload: Record<string, unknown> = {
        organization_id: organizationId,
        subscription_id: currentSubId || null,
        invoice_number: `SUB-${organizationId.slice(0, 8)}-${String(Date.now()).slice(-6)}`,
        status: "pending",
        currency,
        subtotal_amount: subtotalPaise,
        tax_amount: taxAmountPaise,
        total_amount: totalAmountPaise,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        billing_cycle: billingCycle,
        provider: "razorpay",
        provider_environment: getRazorpayEnvironment(),
        idempotency_key: idempotencyKey,
        package_id: targetPackageId,
        due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        issued_at: new Date().toISOString(),
      };

      const { data: inv } = await d
        .from("org_subscription_invoices")
        .insert(invoicePayload)
        .select("id")
        .maybeSingle();

      if (!inv) {
        return { success: false, error: "Failed to create invoice." };
      }
      invoiceId = inv.id;
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
        invoice_id: invoiceId,
        billing_cycle: billingCycle,
        environment: getRazorpayEnvironment(),
      },
      idempotencyKey,
    });

    if (!orderResult.ok) {
      return { success: false, error: orderResult.message };
    }

    const order = orderResult.data;

    await d
      .from("org_subscription_invoices")
      .update({ razorpay_order_id: order.id, status: "issued" })
      .eq("id", invoiceId);

    await d
      .from("org_subscription_payments")
      .insert({
        organization_id: organizationId,
        subscription_id: currentSubId || null,
        invoice_id: invoiceId,
        payment_number: `PAY-${organizationId.slice(0, 8)}-${String(Date.now()).slice(-6)}`,
        status: "created",
        provider: "razorpay",
        provider_environment: getRazorpayEnvironment(),
        provider_order_id: order.id,
        amount: totalAmountPaise,
        currency,
        idempotency_key: idempotencyKey,
      });

    await d
      .from("subscription_events")
      .insert({
        organization_id: organizationId,
        subscription_id: currentSubId || null,
        event_type: "razorpay_order_created",
        actor_id: user.id,
        new_state: { invoiceId, orderId: order.id, amount: totalAmountPaise, currency, billingCycle },
        metadata: { provider: "razorpay", environment: getRazorpayEnvironment(), orderId: order.id },
        reason: `Razorpay order ${order.id} created for ${pkg.name} ${billingCycle}`,
        created_at: new Date().toISOString(),
      });

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();

    return {
      success: true,
      razorpayKeyId: getRazorpayPublicKeyId(),
      razorpayOrderId: order.id,
      amountPaise: totalAmountPaise,
      currency,
      invoiceId,
      packageDisplayName: pkg.name,
      organizationDisplayName: (org as { name: string } | null)?.name ?? "",
      billingCycle,
      isTestMode: getRazorpayEnvironment() === "test",
      environmentLabel: getRazorpayEnvironment() === "test" ? "Test Mode" : "Live",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}
