import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordSubscriptionEvent } from "@/features/super-admin/services/subscription-events-service";
import { recordSubscriptionHistory } from "@/features/super-admin/services/entitlement-service";

const GRACE_PERIOD_DAYS = 7;

/**
 * CRON job: Comprehensive subscription lifecycle management.
 * Runs every hour.
 */
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

  const admin = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: unknown): {
          in(k: string, v: unknown[]): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
          lt(k: string, v: string): {
            eq(k2: string, v2: string): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
          };
        };
        lt(k: string, v: string): {
          eq(k2: string, v2: string): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
          not(k: string, op: string, v: unknown): {
            in(k: string, v: string[]): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
          };
        };
      };
      update(r: Record<string, unknown>): {
        eq(k: string, v: unknown): Promise<{ error: { message: string } | null }>;
        in(k: string, v: unknown[]): Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const now = new Date();
  const results: string[] = [];

  // Step 1: Grace period expired → suspend
  const gracePeriodDate = new Date(now);
  gracePeriodDate.setDate(gracePeriodDate.getDate() - GRACE_PERIOD_DAYS);

  const { data: expiredGrace } = await admin
    .from("organization_subscriptions")
    .select("id, organization_id, status, expires_at")
    .lt("expires_at", gracePeriodDate.toISOString())
    .eq("status", "active");

  if (expiredGrace && expiredGrace.length > 0) {
    const ids = expiredGrace.map((s) => s.id);
    const { error } = await admin
      .from("organization_subscriptions")
      .update({ status: "suspended", updated_at: now.toISOString() })
      .in("id", ids);

    if (!error) {
      results.push(`Suspended ${ids.length} subscription(s) past grace period`);
      for (const sub of expiredGrace) {
        await recordSubscriptionEvent({
          organizationId: sub.organization_id as string,
          subscriptionId: sub.id as string,
          eventType: "suspended",
          newState: { status: "suspended", reason: "grace_period_expired" },
          reason: "Subscription grace period expired. Auto-suspended.",
        });
        await recordSubscriptionHistory({
          subscriptionId: sub.id as string,
          organizationId: sub.organization_id as string,
          eventType: "suspended",
          newState: { status: "suspended", reason: "grace_period_expired" },
          reason: "Grace period expired, auto-suspended",
        });
      }
    }
  }

  // Step 2: Data retention expiry for cancelled subscriptions
  const { data: retentionExpired } = await admin
    .from("organization_subscriptions")
    .select("id, organization_id, status, expires_at")
    .lt("expires_at", now.toISOString())
    .eq("status", "cancelled");

  if (retentionExpired && retentionExpired.length > 0) {
    const ids = retentionExpired.map((s) => s.id);
    const { error } = await admin
      .from("organization_subscriptions")
      .update({ status: "expired", updated_at: now.toISOString() })
      .in("id", ids);

    if (!error) {
      results.push(`Expired ${ids.length} cancelled subscription(s) after data retention`);
      for (const sub of retentionExpired) {
        await recordSubscriptionEvent({
          organizationId: sub.organization_id as string,
          subscriptionId: sub.id as string,
          eventType: "trial_expired",
          previousState: { status: "cancelled" },
          newState: { status: "expired" },
          reason: "Data retention period ended",
        });
      }
    }
  }

  // Step 3: Log grace period entries
  const { data: justExpired } = await admin
    .from("organization_subscriptions")
    .select("id, organization_id, status, expires_at")
    .lt("expires_at", now.toISOString())
    .eq("status", "active");

  if (justExpired && justExpired.length > 0) {
    results.push(`${justExpired.length} subscription(s) in grace period`);
    for (const sub of justExpired) {
      await recordSubscriptionEvent({
        organizationId: sub.organization_id as string,
        subscriptionId: sub.id as string,
        eventType: "limit_warning",
        newState: { status: "active", gracePeriodDays: GRACE_PERIOD_DAYS },
        reason: `Subscription expired, entering ${GRACE_PERIOD_DAYS}-day grace period`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    actions: results.length > 0 ? results : ["No actions taken"],
  });
}
