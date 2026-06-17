"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRazorpayPublicKeyId, getRazorpayEnvironment, isRazorpayLiveMode } from "@/features/billing/razorpay/razorpay-config";
import { validateRazorpayEnvironmentConfig } from "@/features/billing/razorpay/razorpay-health";
import { createRazorpayOrder } from "@/features/billing/razorpay/razorpay-service";
import { calculateTax } from "@/features/billing/services/tax-service";
import { createRazorpayOrderSchema, type CreateRazorpayOrderInput } from "./schemas";

type ActionResult = {
  success: boolean;
  invoiceId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  organizationName?: string;
  customerEmail?: string;
  billingCycle?: string;
  packageName?: string;
  isTestMode?: boolean;
  error?: string;
};

const db = (supabase: any) => supabase as any;

export async function createSubscriptionRazorpayOrderAction(
  input: CreateRazorpayOrderInput,
): Promise<ActionResult> {
  try {
    const parsed = createRazorpayOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const { organizationId, packageId, billingCycle, subscriptionId: existingSubId } = parsed.data;

    // 1. Auth: user must be org owner (from profile org) OR super admin
    const supabase = await createSupabaseServerClient();
    const adminDb = getSupabaseAdminClient() as any;

    // Production safety gate for live mode
    if (isRazorpayLiveMode()) {
      const validation = validateRazorpayEnvironmentConfig();
      if (!validation.valid) {
        return { success: false, error: `Live mode configuration is incomplete. ${validation.errors.join(" ")}` };
      }
      if (!validation.publicKeyMatchesEnvironment) {
        return { success: false, error: "Live mode public key mismatch. Contact support." };
      }
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Authentication required." };

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id as never)
      .maybeSingle();
    const profileOrgId = (profile as unknown as { organization_id: string } | null)?.organization_id;
    const isOrgOwner = profileOrgId === organizationId;
    if (!isOrgOwner) return { success: false, error: "You can only create orders for your own organization." };

    // 2. Check package exists, is active, not Enterprise
    const { data: pkg } = await supabase
      .from("packages")
      .select("id, name, slug, is_active, price, sort_order")
      .eq("id", packageId as never)
      .maybeSingle();
    if (!pkg) return { success: false, error: "Package not found." };
    if (!(pkg as any).is_active) return { success: false, error: "Package is not active." };
    if ((pkg as any).slug === "enterprise") {
      return { success: false, error: "Enterprise plan requires custom contracting. Please contact sales." };
    }

    // 3. Get pricing from DB
    const { data: pricingRows } = await supabase
      .from("package_pricing" as never)
      .select("*")
      .eq("package_id" as never, packageId)
      .eq("billing_period" as never, billingCycle) as any;
    const pricing = (pricingRows ?? [])[0];
    if (!pricing) return { success: false, error: `No pricing found for ${billingCycle}.` };

    let subtotal = pricing.price as number;
    const currency = (pricing.currency as string) || "INR";

    // Check price override
    if (existingSubId) {
      const { data: sub } = await supabase
        .from("organization_subscriptions")
        .select("price_override")
        .eq("id", existingSubId as never)
        .maybeSingle();
      const override = (sub as any)?.price_override;
      if (override != null) subtotal = override;
    }

    if (subtotal <= 0) return { success: false, error: "Invalid price." };

    // 4. Calculate tax
    let taxAmount = 0;
    try { const tax = await calculateTax({ subtotal, organizationId }); taxAmount = tax.totalTax; } catch { /* tax service unavailable */ }
    const totalAmount = subtotal + taxAmount;

    // 5. Generate idempotency key and billing period
    const periodStart = new Date().toISOString().slice(0, 10);
    const daysMap: Record<string, number> = { monthly: 30, annual: 365 };
    const periodEnd = new Date(Date.now() + (daysMap[billingCycle] || 30) * 86400000).toISOString().slice(0, 10);
    const idempotencyKey = `sub_${organizationId}_${packageId}_${billingCycle}_${periodStart}`;

    const invoicePayload: Record<string, unknown> = {
      organization_id: organizationId,
      subscription_id: existingSubId || null,
      invoice_number: `SUB-${organizationId.slice(0, 8)}-${String(Date.now()).slice(-6)}`,
      status: "pending",
      currency,
      subtotal_amount: subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      billing_cycle: billingCycle,
      provider: "razorpay",
      provider_environment: getRazorpayEnvironment(),
      idempotency_key: idempotencyKey,
      package_id: packageId,
      due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      issued_at: new Date().toISOString(),
    };

    // 6. Check existing invoice for same idempotency
    const { data: existingInvs } = await supabase
      .from("org_subscription_invoices" as never)
      .select("id, razorpay_order_id, status, total_amount")
      .eq("idempotency_key" as never, idempotencyKey) as any;
    const existingInv = (existingInvs ?? [])[0];

    let invoiceId: string;
    if (existingInv) {
      invoiceId = existingInv.id;
      if (existingInv.razorpay_order_id && existingInv.status !== "cancelled") {
        return {
          success: true, invoiceId, orderId: existingInv.razorpay_order_id,
          amount: totalAmount, currency, keyId: getRazorpayPublicKeyId(),
          organizationName: "", billingCycle, packageName: (pkg as any).name,
          isTestMode: getRazorpayEnvironment() === "test",
        };
      }
    } else {
    const { data: inv } = await adminDb
      .from("org_subscription_invoices")
      .insert(invoicePayload)
      .select("id")
      .maybeSingle();
    if (!inv) return { success: false, error: "Failed to create invoice." };
    invoiceId = inv.id;
    }

    // 7. Create Razorpay order
    const receipt = `SUB-${organizationId.slice(0, 8)}-${String(Date.now()).slice(-6)}`;
    const orderResult = await createRazorpayOrder({
      amountInRupees: totalAmount / 100,
      currency,
      receipt,
      notes: { organization_id: organizationId, package_id: packageId, invoice_id: invoiceId, billing_cycle: billingCycle, environment: getRazorpayEnvironment() },
      idempotencyKey,
    });
    if (!orderResult.ok) return { success: false, error: orderResult.message };

    const order = orderResult.data;

    // 8. Update invoice with order id
    await adminDb
      .from("org_subscription_invoices")
      .update({ razorpay_order_id: order.id, status: "issued" })
      .eq("id", invoiceId);

    // 9. Create payment record
    await adminDb
      .from("org_subscription_payments")
      .insert({
        organization_id: organizationId,
        subscription_id: existingSubId || null,
        invoice_id: invoiceId,
        payment_number: `PAY-${organizationId.slice(0, 8)}-${String(Date.now()).slice(-6)}`,
        status: "created",
        provider: "razorpay",
        provider_environment: getRazorpayEnvironment(),
        provider_order_id: order.id,
        amount: totalAmount,
        currency,
        idempotency_key: idempotencyKey,
      });

    // 10. Record audit event
    await adminDb
      .from("subscription_events")
      .insert({
        organization_id: organizationId,
        subscription_id: existingSubId || null,
        event_type: "razorpay_order_created",
        actor_id: user.id,
        new_state: { invoiceId, orderId: order.id, amount: totalAmount, currency, billingCycle },
        metadata: { provider: "razorpay", environment: getRazorpayEnvironment(), orderId: order.id },
        reason: `Razorpay order ${order.id} created for ${(pkg as any).name} ${billingCycle}`,
        created_at: new Date().toISOString(),
      });

    // 11. Get org info
    const { data: org } = await supabase
      .from("organizations")
      .select("name, billing_email")
      .eq("id", organizationId as never)
      .maybeSingle();

    return {
      success: true,
      invoiceId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayPublicKeyId(),
      organizationName: (org as any)?.name ?? "",
      customerEmail: (org as any)?.billing_email ?? "",
      billingCycle,
      packageName: (pkg as any).name,
      isTestMode: getRazorpayEnvironment() === "test",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}
