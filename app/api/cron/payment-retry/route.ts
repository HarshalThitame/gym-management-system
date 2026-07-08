import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/services/email/resend";
import { createRazorpayOrder } from "@/features/billing/razorpay/razorpay-service";
import {
  dunningFirstAttempt,
  dunningSecondAttempt,
  dunningFinalAttempt,
  paymentRecoveredNotification,
  subscriptionSuspendedNotification,
} from "@/emails/subscription";
import { recordSubscriptionEvent } from "@/features/super-admin/services/subscription-events-service";
import type { Json } from "@/types/database";

type DbSubRow = {
  id: string;
  organization_id: string;
  status: string;
  dunning_attempts: number;
  dunning_next_retry: string | null;
  dunning_history: unknown;
  package_id: string;
};

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;
type DbPromise<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type DB = {
  from(t: string): {
    select(c: string): {
      eq(c: string, v: unknown): {
        single(): DbPromise<Record<string, unknown>>;
        gte(c: string, v: string): { lte(c2: string, v2: string): DbPromise<Array<Record<string, unknown>>> };
      };
      not(c: string, op: string, v: unknown): {
        in(c: string, v: string[]): {
          lte(c: string, v: string): DbPromise<DbSubRow[]>;
        };
      };
      in(c: string, v: string[]): DbPromise<Array<Record<string, unknown>>>;
      update(r: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
      insert(r: Record<string, unknown>): DbPromise<Record<string, unknown>>;
    };
  };
};

function getDb(admin: NonNullable<AdminClient>): DB {
  return admin as never as DB;
}

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
  const { data: dueForRetry } = await db
    .from("organization_subscriptions")
    .select("")
    .not("dunning_next_retry", "is", null)
    .in("status", ["active", "suspended"])
    .lte("dunning_next_retry", now.toISOString());

  if (!dueForRetry || dueForRetry.length === 0) {
    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      actions: ["No subscriptions due for retry"],
    });
  }

  const orgIds = [...new Set(dueForRetry.map((s) => s.organization_id))];
  const pkgIds = [...new Set(dueForRetry.map((s) => s.package_id))];

  const { data: orgsResult } = await db.from("organizations").select("").in("id", orgIds);
  const orgMap = new Map((orgsResult ?? []).map((o) => [o.id, o]));

  const [pkgsResult, pricingResult] = await Promise.all([
    db.from("packages").select("").in("id", pkgIds),
    db.from("package_pricing").select("").in("package_id", pkgIds),
  ]);
  const pkgMap = new Map((pkgsResult.data ?? []).map((p) => [p.id, p]));
  const pricingByKey = new Map<string, Record<string, unknown>>();
  for (const pr of pricingResult.data ?? []) {
    pricingByKey.set(`${pr.package_id}:${pr.billing_period}`, pr);
  }

  let retried = 0;
  let suspended = 0;
  let recovered = 0;

  for (const sub of dueForRetry) {
    const org = orgMap.get(sub.organization_id) as { name: string; billing_email: string | null } | undefined;
    if (!org?.billing_email) continue;

    const nextAttempt = sub.dunning_attempts + 1;
    const pkg = pkgMap.get(sub.package_id) as { name: string; price: number; currency: string } | undefined;
    const billingPeriod = (sub as Record<string, unknown>).billing_period as string | undefined || "monthly";
    const priceOverride = (sub as Record<string, unknown>).price_override as number | null | undefined;

    let price: number;
    let currency: string;
    if (priceOverride !== null && priceOverride !== undefined) {
      price = priceOverride;
      currency = (pkg?.currency as string) ?? "INR";
    } else {
      const pricingRow = pricingByKey.get(`${sub.package_id}:${billingPeriod}`);
      if (!pricingRow || typeof pricingRow.price !== "number") {
        console.error(`[payment-retry] Missing package_pricing for package ${sub.package_id}, billing_period ${billingPeriod}. Using price_override or skipping.`);
        continue;
      }
      price = pricingRow.price as number;
      currency = (pricingRow.currency as string) ?? "INR";
    }

    const paymentResult = await processPaymentRetry(sub.organization_id, sub.id, price, currency);

    const daysOverdue = Math.floor(
      (now.getTime() - new Date(sub.dunning_next_retry ?? now.toISOString()).getTime())
      / (1000 * 60 * 60 * 24),
    );

    if (paymentResult.success) {
      await db.from("organization_subscriptions").select("").update({
        status: "active",
        dunning_attempts: 0,
        dunning_next_retry: null,
        dunning_history: appendDunningHistory(sub.dunning_history, {
          date: now.toISOString(),
          attempt: nextAttempt,
          result: "recovered",
          orderId: paymentResult.orderId,
        }),
      }).eq("id", sub.id);

      await sendEmail({
        to: org.billing_email,
        subject: "Payment recovered — subscription restored",
        html: paymentRecoveredNotification({ orgName: org.name, planName: pkg?.name ?? "Current Plan" }),
      });

      await recordSubscriptionEvent({
        organizationId: sub.organization_id,
        subscriptionId: sub.id,
        eventType: "payment_recovered",
        reason: `Dunning retry succeeded on attempt ${nextAttempt} (Razorpay order: ${paymentResult.orderId})`,
        metadata: { dunningAttempt: nextAttempt, razorpayOrderId: paymentResult.orderId ?? null } as Record<string, Json>,
      });

      recovered++;
    } else if (nextAttempt >= 3) {
      await db.from("organization_subscriptions").select("").update({
        status: "suspended",
        dunning_attempts: nextAttempt,
        dunning_next_retry: null,
        dunning_history: appendDunningHistory(sub.dunning_history, {
          date: now.toISOString(),
          attempt: nextAttempt,
          result: "suspended",
        }),
      }).eq("id", sub.id);

      await sendEmail({
        to: org.billing_email,
        subject: "Subscription suspended due to non-payment",
        html: subscriptionSuspendedNotification({ orgName: org.name, planName: pkg?.name ?? "Current Plan" }),
      });

      await recordSubscriptionEvent({
        organizationId: sub.organization_id,
        subscriptionId: sub.id,
        eventType: "suspended",
        reason: `Dunning exhausted after ${nextAttempt} attempts`,
        metadata: { dunningAttempt: nextAttempt, cause: "payment_failure" } as Record<string, Json>,
      });

      suspended++;
    } else {
      const retryDelayDays = [3, 5, 7][nextAttempt - 1] ?? 7;
      const nextRetry = new Date(now);
      nextRetry.setDate(nextRetry.getDate() + retryDelayDays);

      await db.from("organization_subscriptions").select("").update({
        dunning_attempts: nextAttempt,
        dunning_next_retry: nextRetry.toISOString(),
        dunning_history: appendDunningHistory(sub.dunning_history, {
          date: now.toISOString(),
          attempt: nextAttempt,
          result: "failed",
          nextRetry: nextRetry.toISOString(),
          orderId: paymentResult.orderId,
        }),
      }).eq("id", sub.id);

      const emailHtml = getDunningEmail(nextAttempt, {
        orgName: org.name,
        planName: pkg?.name ?? "Current Plan",
        amount: paymentResult.amount ?? price,
        dueDate: sub.dunning_next_retry ?? now.toISOString(),
        daysOverdue: Math.abs(daysOverdue),
      });

      const subject = getDunningSubject(nextAttempt);
      await sendEmail({ to: org.billing_email, subject, html: emailHtml });

      await recordSubscriptionEvent({
        organizationId: sub.organization_id,
        subscriptionId: sub.id,
        eventType: "dunning_attempt",
        reason: `Dunning retry ${nextAttempt}/3 failed. Razorpay order: ${paymentResult.orderId ?? "N/A"}. Next retry: ${nextRetry.toISOString()}`,
        metadata: { dunningAttempt: nextAttempt, nextRetry: nextRetry.toISOString(), razorpayOrderId: paymentResult.orderId ?? null } as Record<string, Json>,
      });

      retried++;
    }
  }

  const actions: string[] = [];
  if (retried > 0) actions.push(`Retried ${retried} payment(s)`);
  if (suspended > 0) actions.push(`Suspended ${suspended} subscription(s)`);
  if (recovered > 0) actions.push(`Recovered ${recovered} payment(s)`);
  if (actions.length === 0) actions.push("No actions taken");

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    actions,
    stats: { retried, suspended, recovered },
  });
}

async function processPaymentRetry(
  organizationId: string,
  subscriptionId: string,
  price: number,
  currency: string,
): Promise<{ success: boolean; amount?: number; orderId?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { success: false };

  const amountInRupees = price / 100;
  try {
    const orderResult = await createRazorpayOrder({
      amountInRupees,
      currency: currency || "INR",
      receipt: `DUN-${organizationId.slice(0, 8)}-${Date.now()}`,
      notes: {
        organization_id: organizationId,
        subscription_id: subscriptionId,
        type: "dunning_retry",
      },
    });

    if (!orderResult.ok) return { success: false };

    return {
      success: true,
      orderId: orderResult.data.id,
      amount: price,
    };
  } catch {
    return { success: false };
  }
}

function appendDunningHistory(existing: unknown, entry: Record<string, unknown>): unknown {
  try {
    const history = Array.isArray(existing) ? existing : [];
    return [...history, entry];
  } catch {
    return [entry];
  }
}

function getDunningEmail(
  attempt: number,
  input: { orgName: string; planName: string; amount: number; dueDate: string; daysOverdue: number },
): string {
  switch (attempt) {
    case 1:
      return dunningFirstAttempt({
        orgName: input.orgName,
        planName: input.planName,
        amount: input.amount,
        dueDate: input.dueDate,
      });
    case 2:
      return dunningSecondAttempt({
        orgName: input.orgName,
        planName: input.planName,
        amount: input.amount,
        daysOverdue: input.daysOverdue,
      });
    case 3:
      return dunningFinalAttempt({
        orgName: input.orgName,
        planName: input.planName,
        amount: input.amount,
        daysOverdue: input.daysOverdue,
      });
    default:
      return dunningFirstAttempt({
        orgName: input.orgName,
        planName: input.planName,
        amount: input.amount,
        dueDate: input.dueDate,
      });
  }
}

function getDunningSubject(attempt: number): string {
  switch (attempt) {
    case 1:
      return "Payment failed — action needed";
    case 2:
      return "Payment still overdue — 2nd notice";
    case 3:
      return "Final notice — subscription will be suspended";
    default:
      return "Payment action required";
  }
}
