import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/utils";
import { createRazorpayOrder } from "../razorpay/razorpay-service";
import { sendEmail } from "@/services/email/resend";
import {
  subscriptionInvoiceNotification,
  paymentRecoveredNotification,
  subscriptionSuspendedNotification,
} from "@/emails/subscription";
import { recordSubscriptionEvent } from "@/features/super-admin/services/subscription-events-service";

type Supabase = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
type DB = {
  from(t: string): DBRoot;
};

type DBRoot = DBSelect & DBUpdate & DBInsert;

type DBSelect = {
  select(c: string): DBSelectChain;
};

type DBSelectChain = {
  eq(c: string, v: unknown): DBSelectEq;
  in(c: string, v: string[]): DBSelectIn;
  not(c: string, op: string, v: unknown): DBSelectNotIn;
  order(c: string, o: { ascending: boolean }): QueryResLimit;
  update(r: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
  insert(r: Record<string, unknown>): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};

type DBSelectNotIn = Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> & {
  lte(c: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
};

type DBSelectIn = Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> & {
  not(c: string, op: string, v: unknown): {
    lte(c: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
  };
  lte(c: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
};

type DBSelectEq = {
  single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  gte(c: string, v: string): { lte(c2: string, v2: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> };
  not(c: string, op: string, v: unknown): {
    in(c: string, v: string[]): {
      lte(c: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
    };
  };
};

type DBUpdate = {
  update(r: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
};

type DBInsert = {
  insert(r: Record<string, unknown>): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};
type QueryResLimit = {
  limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
};

function getDb(admin: Supabase): DB {
  return admin as never as DB;
}

export type BillingResult = {
  invoiceGenerated: number;
  ordersCreated: number;
  emailsSent: number;
  errors: string[];
};

const BILLING_PERIOD_MAP: Record<string, number> = {
  monthly: 30,
  annual: 365,
};

export async function runSubscriptionBilling(): Promise<BillingResult> {
  const result: BillingResult = { invoiceGenerated: 0, ordersCreated: 0, emailsSent: 0, errors: [] };
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    result.errors.push("Supabase admin client not configured");
    return result;
  }
  const db = getDb(supabase);
  const now = new Date();

  const { data: subsDue } = await db
    .from("organization_subscriptions")
    .select("*")
    .in("status", ["active", "trial"])
    .not("next_billing_date", "is", null)
    .lte("next_billing_date", now.toISOString());

  if (!subsDue || subsDue.length === 0) return result;

  // Exclude subscriptions with a scheduled (pending) cancellation — they should
  // not be billed for a new period since auto_renew is already disabled.
  const billableSubs = subsDue.filter((s: Record<string, unknown>) => {
    const cancelledAt = s.cancelled_at as string | null;
    const autoRenew = s.auto_renew as boolean | null;
    if (cancelledAt && autoRenew === false) return false;
    return true;
  });

  if (billableSubs.length === 0) return result;

  const invoiceModeSubs = billableSubs.filter((s: Record<string, unknown>) => {
    const billingEngine = s.billing_engine as string | null;
    const providerSubscriptionId = s.provider_subscription_id as string | null;
    return billingEngine !== "subscription" && !providerSubscriptionId;
  });

  if (invoiceModeSubs.length === 0) return result;

  const orgIds = [...new Set(invoiceModeSubs.map((s) => s.organization_id as string))];

  const { data: orgs } = await db.from("organizations").select("*").in("id", orgIds);
  const orgMap = new Map((orgs ?? []).map((o) => [o.id as string, o]));
  const { data: paymentMethods } = await db
    .from("org_payment_methods")
    .select("id, organization_id, is_default, is_active")
    .in("organization_id", orgIds);
  const defaultPaymentMethodByOrg = new Map<string, string>();
  for (const method of paymentMethods ?? []) {
    if (method.is_active !== true || method.is_default !== true) continue;
    const organizationId = method.organization_id as string;
    if (!defaultPaymentMethodByOrg.has(organizationId)) {
      defaultPaymentMethodByOrg.set(organizationId, method.id as string);
    }
  }

  const pkgIds = [...new Set(invoiceModeSubs.map((s) => s.package_id as string))];
  const [packagesResult, pricingResult] = await Promise.all([
    db.from("packages").select("*").in("id", pkgIds),
    db.from("package_pricing").select("*").in("package_id", pkgIds),
  ]);
  const pkgMap = new Map((packagesResult.data ?? []).map((p) => [p.id as string, p]));
  const pricingByKey = new Map<string, Record<string, unknown>>();
  for (const pr of pricingResult.data ?? []) {
    pricingByKey.set(`${pr.package_id}:${pr.billing_period}`, pr);
  }

  for (const sub of invoiceModeSubs) {
    try {
      const org = orgMap.get(sub.organization_id as string);
      const pkg = pkgMap.get(sub.package_id as string);
      if (!org || !pkg) {
        result.errors.push(`Missing org or package for sub ${sub.id}`);
        continue;
      }

      const billingEmail = org.billing_email as string | null;
      if (!billingEmail) {
        result.errors.push(`Missing billing email for org ${sub.organization_id}. subscription ${sub.id} skipped`);
        continue;
      }

      const billingPeriod = (sub.billing_period as string) || "monthly";
      const priceOverride = sub.price_override as number | null;

      let price: number;
      let currency: string;
      if (priceOverride !== null && priceOverride !== undefined) {
        price = priceOverride;
        currency = (pkg.currency as string) || "INR";
      } else {
        const pricingRow = pricingByKey.get(`${sub.package_id}:${billingPeriod}`);
        if (!pricingRow || typeof pricingRow.price !== "number") {
          result.errors.push(`Missing package_pricing for package ${sub.package_id}, billing_period ${billingPeriod}. Subscription ${sub.id} skipped — cannot bill without valid pricing.`);
          continue;
        }
        price = pricingRow.price as number;
        currency = (pricingRow.currency as string) || "INR";
      }

      if (price <= 0) {
        result.errors.push(`Invalid price ${price} for subscription ${sub.id}. Skipping — cannot bill zero or negative amount.`);
        continue;
      }

      const daysUntilNextBilling = BILLING_PERIOD_MAP[billingPeriod] ?? 30;

      // Idempotency — skip if invoice already exists for this sub + billing period window
      const idempotencyKey = `renew_${sub.organization_id}_${sub.package_id}_${billingPeriod}_${now.toISOString().slice(0, 10)}`;
      const { data: existingInvoices } = await db
        .from("org_subscription_invoices")
        .select("id, status, razorpay_order_id")
        .eq("organization_id", sub.organization_id as string)
        .eq("idempotency_key", idempotencyKey)
        .limit(1) as unknown as { data: Array<Record<string, unknown>> | null; error: { message: string } | null };

      if (existingInvoices && existingInvoices.length > 0) {
        const existingInvoice = existingInvoices[0] as Record<string, unknown>;
        const existingOrderId = existingInvoice.razorpay_order_id as string | null;
        // If the existing invoice has no Razorpay order, it's a stuck draft
        // from a previous failed run (order creation failed after invoice was
        // created). Clean it up so the next attempt can create a fresh one.
        if (!existingOrderId) {
          await (supabase as any)
            .from("org_subscription_invoices")
            .delete()
            .eq("id", existingInvoice.id as string);
          result.errors.push(`Cleaned up stuck invoice ${existingInvoice.id} for sub ${sub.id} — retrying.`);
        } else {
          result.errors.push(`Duplicate invoice blocked for sub ${sub.id}: invoice ${existingInvoice.id} already exists with key ${idempotencyKey}`);
          continue;
        }
      }

      const invoiceNumber = `SUB-INV-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
      const periodStart = new Date(now);
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + daysUntilNextBilling);
      const defaultPaymentMethodId = defaultPaymentMethodByOrg.get(sub.organization_id as string) ?? null;

      const { data: invoice, error: invoiceError } = await (supabase as any)
        .from("org_subscription_invoices")
        .insert({
          organization_id: sub.organization_id,
          subscription_id: sub.id,
          package_id: sub.package_id,
          payment_method_id: defaultPaymentMethodId,
          invoice_number: invoiceNumber,
          status: "issued",
          currency,
          subtotal_amount: price,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: price,
          billing_period_start: periodStart.toISOString().slice(0, 10),
          billing_period_end: periodEnd.toISOString().slice(0, 10),
          billing_cycle: billingPeriod,
          issued_at: now.toISOString(),
          due_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          idempotency_key: idempotencyKey,
        })
        .select("*")
        .single();

      if (invoiceError || !invoice) {
        result.errors.push(`Failed to create invoice for sub ${sub.id}: ${invoiceError?.message ?? "unknown error"}`);
        continue;
      }
      result.invoiceGenerated++;

      const razorpayReceipt = `SUB-${sub.organization_id?.toString().slice(0, 8)}-${Date.now()}`;
      // price is in paise; createRazorpayOrder expects rupees
      const amountInRupees = price / 100;
      const orderResult = await createRazorpayOrder({
        amountInRupees,
        currency,
        receipt: razorpayReceipt,
        notes: {
          organization_id: sub.organization_id as string,
          subscription_id: sub.id as string,
          invoice_id: invoice.id as string,
          billing_period: billingPeriod,
        },
      });

      if (!orderResult.ok) {
        result.errors.push(`Razorpay order failed for sub ${sub.id}: ${orderResult.message}`);
        continue;
      }
      result.ordersCreated++;

      const razorpayOrderId = orderResult.data.id;
      await db.from("org_subscription_invoices").update({
        razorpay_order_id: razorpayOrderId,
      }).eq("id", invoice.id as string);

      const paymentLink = `https://rzp.io/i/${razorpayOrderId}`;
      const emailResult = await sendEmail({
        to: billingEmail,
        subject: `Invoice #${invoiceNumber} — payment due`,
        html: subscriptionInvoiceNotification({
          orgName: org.name as string,
          planName: pkg.name as string,
          amount: price,
          dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          invoiceNumber,
          paymentLink,
        }),
      });

      if (emailResult.sent) {
        result.emailsSent++;
      }

      // Advance next_billing_date and expires_at so cron does not re-fire for the same period.
      // The RPC finalize_razorpay_subscription_payment will correct these on payment confirmation.
      const nextBilling = new Date(now);
      nextBilling.setDate(nextBilling.getDate() + daysUntilNextBilling);

      await db.from("organization_subscriptions").update({
        last_billing_date: now.toISOString(),
        next_billing_date: nextBilling.toISOString(),
        expires_at: periodEnd.toISOString(),
      }).eq("id", sub.id as string);

      await recordSubscriptionEvent({
        organizationId: sub.organization_id as string,
        subscriptionId: sub.id as string,
        eventType: "renewed",
        newState: {
          invoiceId: invoice.id,
          razorpayOrderId,
          amount: price,
          nextBillingDate: nextBilling.toISOString(),
          paymentMethodId: defaultPaymentMethodId,
        },
        reason: `Renewal invoice ${invoiceNumber} issued and Razorpay order ${razorpayOrderId} created for ${billingPeriod} billing period`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      result.errors.push(`Error processing sub ${sub.id}: ${message}`);
    }
  }

  return result;
}

export type DunningPaymentResult = {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  error?: string;
};

export async function processDunningRetry(subscriptionId: string, organizationId: string, price: number, currency: string): Promise<DunningPaymentResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { success: false, error: "Supabase admin client not configured" };

  try {
    const amountInRupees = price / 100;
    const orderResult = await createRazorpayOrder({
      amountInRupees,
      currency: currency || "INR",
      receipt: `DUN-${organizationId.slice(0, 8)}-${Date.now()}`,
      notes: {
        organization_id: organizationId,
        subscription_id: subscriptionId,
        type: "dunning_retry",
        environment: "test",
      },
    });

    if (!orderResult.ok) return { success: false, error: orderResult.message };

    return {
      success: true,
      orderId: orderResult.data.id,
      amount: price,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
