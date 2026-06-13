import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder } from "@/features/billing/lib/razorpay";
import { sendEmail } from "@/services/email/resend";
import { subscriptionInvoiceNotification } from "@/emails/subscription";
import { recordSubscriptionEvent } from "@/features/super-admin/services/subscription-events-service";

type DbResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type NotChain = {
  in(c: string, v: string[]): InResult;
  lte(c: string, v: string): DbResult<Array<Record<string, unknown>>>;
};
type InResult = {
  lte(c: string, v: string): DbResult<Array<Record<string, unknown>>>;
  not(c: string, op: string, v: unknown): NotChain;
};
type InChain = InResult & DbResult<Array<Record<string, unknown>>>;
type DB = {
  from(t: string): {
    select(c: string): {
      eq(c: string, v: unknown): {
        not(c: string, op: string, v: unknown): NotChain;
        single(): DbResult<Record<string, unknown>>;
      };
      in(c: string, v: string[]): InChain;
      update(r: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
      insert(r: Record<string, unknown>): DbResult<Array<Record<string, unknown>>>;
    };
  };
};

function getDb(admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>): DB {
  return admin as never as DB;
}

const BILLING_PERIOD_MAP: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  half_yearly: 180,
  annual: 365,
};

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client not configured" }, { status: 503 });
  }

  const db = getDb(supabase);
  const now = new Date();
  const errors: string[] = [];
  let invoicesGenerated = 0;
  let ordersCreated = 0;
  let emailsSent = 0;
  let cancellationsProcessed = 0;

  // Process overdue pending cancellations (cancelled_at has passed)
  const { data: overdueCancels } = await db
    .from("organization_subscriptions")
    .select("")
    .in("status", ["active", "trial"])
    .lte("cancelled_at", now.toISOString());
  if (overdueCancels && overdueCancels.length > 0) {
    for (const sub of overdueCancels) {
      await db.from("organization_subscriptions").select("").update({
        status: "cancelled",
      }).eq("id", sub.id as string);
      await recordSubscriptionEvent({
        organizationId: sub.organization_id as string,
        subscriptionId: sub.id as string,
        eventType: "cancelled",
        previousState: { status: sub.status },
        newState: { status: "cancelled", reason: "End of billing period reached" },
        reason: "Scheduled end-of-period cancellation processed",
      });
      cancellationsProcessed++;
    }
  }

  // Skip subscriptions with pending end-of-period cancellation
  const { data: subsDue } = await db
    .from("organization_subscriptions")
    .select("")
    .in("status", ["active", "trial"])
    .not("next_billing_date", "is", null)
    .lte("next_billing_date", now.toISOString());

  const activeSubsDue = (subsDue as Array<Record<string, unknown>> ?? []).filter((s: Record<string, unknown>) => s.cancelled_at == null);

  if (activeSubsDue.length === 0) {
    const msg = cancellationsProcessed > 0
      ? `Processed ${cancellationsProcessed} overdue cancellation(s); no subscriptions due for billing`
      : "No subscriptions due for billing";
    return NextResponse.json({ ok: true, timestamp: now.toISOString(), actions: [msg], stats: { cancellationsProcessed } });
  }

  const orgIds = [...new Set(activeSubsDue.map((s) => s.organization_id as string))];
  const { data: orgs } = await db.from("organizations").select("").in("id", orgIds);
  const orgMap = new Map((orgs ?? []).map((o) => [o.id as string, o]));

  const pkgIds = [...new Set(activeSubsDue.map((s) => s.package_id as string))];
  const { data: packages } = await db.from("packages").select("").in("id", pkgIds);
  const pkgMap = new Map((packages ?? []).map((p) => [p.id as string, p]));

  for (const sub of activeSubsDue) {
    try {
      const org = orgMap.get(sub.organization_id as string);
      const pkg = pkgMap.get(sub.package_id as string);
      if (!org || !pkg) {
        errors.push(`Missing org or package for sub ${sub.id}`);
        continue;
      }

      const billingEmail = org.billing_email as string | null;
      if (!billingEmail) {
        errors.push(`No billing email for org ${sub.organization_id}`);
        continue;
      }

      const priceOverride = sub.price_override as number | null;
      const price = priceOverride ?? (pkg.price as number);
      const billingPeriod = (sub.billing_period as string) || (pkg.billing_period as string) || "monthly";
      const daysUntilNextBilling = BILLING_PERIOD_MAP[billingPeriod] ?? 30;
      const currency = (pkg.currency as string) || "INR";

      const year = now.getFullYear();
      const ts = String(Date.now()).slice(-6);
      const invoiceNumber = `SUB-INV-${year}-${ts}`;

      const periodStart = now.toISOString().slice(0, 10);
      const periodEnd = new Date(now.getTime() + daysUntilNextBilling * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { data: invoice } = await db.from("org_subscription_invoices").select("").insert({
        organization_id: sub.organization_id,
        subscription_id: sub.id,
        invoice_number: invoiceNumber,
        status: "issued",
        currency,
        subtotal_amount: price,
        discount_amount: 0,
        tax_amount: 0,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        issued_at: now.toISOString(),
        due_at: dueDate.toISOString(),
      });

      if (!invoice || invoice.length === 0) {
        errors.push(`Failed to create invoice for sub ${sub.id}`);
        continue;
      }
      const inv = invoice[0]!;
      invoicesGenerated++;

      const razorpayReceipt = `SUB-${String(sub.organization_id).slice(0, 8)}-${Date.now()}`;
      const orderResult = await createRazorpayOrder({
        amount: price,
        currency,
        receipt: razorpayReceipt,
        notes: {
          organization_id: sub.organization_id as string,
          subscription_id: sub.id as string,
          invoice_id: inv.id as string,
          billing_period: billingPeriod,
        },
      });

      if (!orderResult.ok) {
        errors.push(`Razorpay order failed for sub ${sub.id}: ${orderResult.message}`);
        continue;
      }
      ordersCreated++;

      const razorpayOrderId = orderResult.order.id;
      await db.from("org_subscription_invoices").select("").update({
        razorpay_order_id: razorpayOrderId,
      }).eq("id", inv.id as string);

      const paymentLink = `https://rzp.io/i/${razorpayOrderId}`;
      const emailResult = await sendEmail({
        to: billingEmail,
        subject: `Invoice #${invoiceNumber} — payment due`,
        html: subscriptionInvoiceNotification({
          orgName: org.name as string,
          planName: pkg.name as string,
          amount: price,
          dueDate: dueDate.toISOString(),
          invoiceNumber,
          paymentLink,
        }),
      });

      if (emailResult.sent) emailsSent++;

      const nextBilling = new Date(now.getTime() + daysUntilNextBilling * 24 * 60 * 60 * 1000);
      await db.from("organization_subscriptions").select("").update({
        last_billing_date: now.toISOString(),
        next_billing_date: nextBilling.toISOString(),
      }).eq("id", sub.id as string);

      await recordSubscriptionEvent({
        organizationId: sub.organization_id as string,
        subscriptionId: sub.id as string,
        eventType: "renewed",
        newState: { invoiceId: inv.id, razorpayOrderId, amount: price },
        reason: `Auto-billing: invoice ${invoiceNumber}, Razorpay order ${razorpayOrderId}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Error processing sub ${sub.id}: ${message}`);
    }
  }

  const actions: string[] = [];
  if (invoicesGenerated > 0) actions.push(`Generated ${invoicesGenerated} invoice(s)`);
  if (ordersCreated > 0) actions.push(`Created ${ordersCreated} Razorpay order(s)`);
  if (emailsSent > 0) actions.push(`Sent ${emailsSent} invoice email(s)`);
  if (errors.length > 0) actions.push(`${errors.length} error(s) occurred`);
  if (actions.length === 0) actions.push("No actions taken");

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    actions,
    stats: { invoicesGenerated, ordersCreated, emailsSent, errors: errors.length, cancellationsProcessed },
  });
}
