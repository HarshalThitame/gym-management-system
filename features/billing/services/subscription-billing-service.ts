import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/utils";
import { createRazorpayOrder } from "../lib/razorpay";
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
  order(c: string, o: { ascending: boolean }): QueryResLimit;
  update(r: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
  insert(r: Record<string, unknown>): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
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
  quarterly: 90,
  half_yearly: 180,
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
    .select("")
    .in("status", ["active", "trial"])
    .not("next_billing_date", "is", null)
    .lte("next_billing_date", now.toISOString());

  if (!subsDue || subsDue.length === 0) return result;

  const orgIds = [...new Set(subsDue.map((s) => s.organization_id as string))];

  const { data: orgs } = await db.from("organizations").select("").in("id", orgIds);
  const orgMap = new Map((orgs ?? []).map((o) => [o.id as string, o]));

  const pkgIds = [...new Set(subsDue.map((s) => s.package_id as string))];
  const { data: packages } = await db.from("packages").select("").in("id", pkgIds);
  const pkgMap = new Map((packages ?? []).map((p) => [p.id as string, p]));

  for (const sub of subsDue) {
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
      const priceOverride = sub.price_override as number | null;
      const price = priceOverride ?? (pkg.price as number);
      const billingPeriod = (sub.billing_period as string) || (pkg.billing_period as string) || "monthly";
      const daysUntilNextBilling = BILLING_PERIOD_MAP[billingPeriod] ?? 30;
      const currency = (pkg.currency as string) || "INR";

      const invoiceNumber = `SUB-INV-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
      const periodStart = new Date(now);
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + daysUntilNextBilling);

      const { data: invoice } = await db.from("org_subscription_invoices").select("").insert({
        organization_id: sub.organization_id,
        subscription_id: sub.id,
        invoice_number: invoiceNumber,
        status: "issued",
        currency,
        subtotal_amount: price,
        discount_amount: 0,
        tax_amount: 0,
        billing_period_start: periodStart.toISOString().slice(0, 10),
        billing_period_end: periodEnd.toISOString().slice(0, 10),
        issued_at: now.toISOString(),
        due_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (!invoice) {
        result.errors.push(`Failed to create invoice for sub ${sub.id}`);
        continue;
      }
      result.invoiceGenerated++;

      const razorpayReceipt = `SUB-${sub.organization_id?.toString().slice(0, 8)}-${Date.now()}`;
      const orderResult = await createRazorpayOrder({
        amount: price,
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

      const razorpayOrderId = orderResult.order.id;
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

      const nextBilling = new Date(now);
      nextBilling.setDate(nextBilling.getDate() + daysUntilNextBilling);

      await db.from("organization_subscriptions").update({
        last_billing_date: now.toISOString(),
        next_billing_date: nextBilling.toISOString(),
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
        },
        reason: `Subscription billing invoice ${invoiceNumber} generated and Razorpay order ${razorpayOrderId} created`,
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
    const orderResult = await createRazorpayOrder({
      amount: price,
      currency: currency || "INR",
      receipt: `DUN-${organizationId.slice(0, 8)}-${Date.now()}`,
      notes: {
        organization_id: organizationId,
        subscription_id: subscriptionId,
        type: "dunning_retry",
      },
    });

    if (!orderResult.ok) {
      return { success: false, error: orderResult.message };
    }

    return {
      success: true,
      orderId: orderResult.order.id,
      amount: price,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
