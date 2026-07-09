import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordSubscriptionEvent } from "@/features/super-admin/services/subscription-events-service";
import { recordSubscriptionHistory } from "@/features/super-admin/services/entitlement-service";
import { syncSubscriptionArtifactsForOrganization } from "@/features/super-admin/services/subscription-entitlement-sync";

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

  // Step 1: Pending cancellations — transition active subscriptions with
  // cancelled_at in the past to cancelled (end-of-period cancellation).
  // Run before grace-period suspension so pending-cancel subs are not
  // wrongfully suspended when their expires_at aligns with cancelled_at.
  const { data: pendingCancel } = await admin
    .from("organization_subscriptions")
    .select("id, organization_id, status, cancelled_at")
    .lt("cancelled_at", now.toISOString())
    .eq("status", "active");

  if (pendingCancel && pendingCancel.length > 0) {
    const ids = pendingCancel.map((s) => s.id);
    const { error } = await admin
      .from("organization_subscriptions")
      .update({
        status: "cancelled",
        updated_at: now.toISOString(),
        expires_at: now.toISOString(),
      })
      .in("id", ids);

    if (!error) {
      results.push(`Cancelled ${ids.length} subscription(s) at end of billing period`);
      for (const sub of pendingCancel) {
        await syncSubscriptionArtifactsForOrganization(
          sub.organization_id as string,
          "Subscription lifecycle cron cancelled subscription at end of billing period.",
        );
        await recordSubscriptionEvent({
          organizationId: sub.organization_id as string,
          subscriptionId: sub.id as string,
          eventType: "cancelled",
          previousState: { status: "active", cancelled_at: sub.cancelled_at },
          newState: { status: "cancelled" },
          reason: "End of billing period reached — scheduled cancellation executed.",
        });
        await recordSubscriptionHistory({
          subscriptionId: sub.id as string,
          organizationId: sub.organization_id as string,
          eventType: "cancelled",
          newState: { status: "cancelled" },
          reason: "Scheduled cancellation executed at end of billing period.",
        });
      }
    }
  }

  // Step 2: Grace period expired → suspend
  // Pending-cancel subscriptions are excluded here because Step 1 already
  // transitioned them to 'cancelled' (they were still 'active' at query time
  // but no longer match the status filter after the UPDATE).
  const gracePeriodDate = new Date(now);
  gracePeriodDate.setDate(gracePeriodDate.getDate() - GRACE_PERIOD_DAYS);

  const { data: expiredGrace } = await admin
    .from("organization_subscriptions")
    .select("id, organization_id, status, expires_at, billing_engine, provider_subscription_id")
    .lt("expires_at", gracePeriodDate.toISOString())
    .eq("status", "active");

  const billableExpiredGrace = (expiredGrace ?? []).filter((sub) => {
    const billingEngine = sub.billing_engine as string | null;
    const providerSubscriptionId = sub.provider_subscription_id as string | null;
    return billingEngine !== "subscription" && !providerSubscriptionId;
  });

  if (billableExpiredGrace.length > 0) {
    const ids = billableExpiredGrace.map((s) => s.id);
    const { error } = await admin
      .from("organization_subscriptions")
      .update({ status: "suspended", updated_at: now.toISOString() })
      .in("id", ids);

    if (!error) {
      results.push(`Suspended ${ids.length} subscription(s) past grace period`);
      for (const sub of billableExpiredGrace) {
        await syncSubscriptionArtifactsForOrganization(
          sub.organization_id as string,
          "Subscription lifecycle cron suspended subscription after grace period.",
        );
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

  // Step 4: Data retention expiry for cancelled subscriptions
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
        await syncSubscriptionArtifactsForOrganization(
          sub.organization_id as string,
          "Subscription lifecycle cron expired cancelled subscription after retention period.",
        );
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

  // Step 5: Log grace period entries
  const { data: justExpired } = await admin
    .from("organization_subscriptions")
    .select("id, organization_id, status, expires_at, billing_engine, provider_subscription_id")
    .lt("expires_at", now.toISOString())
    .eq("status", "active");

  const billableJustExpired = (justExpired ?? []).filter((sub) => {
    const billingEngine = sub.billing_engine as string | null;
    const providerSubscriptionId = sub.provider_subscription_id as string | null;
    return billingEngine !== "subscription" && !providerSubscriptionId;
  });

  if (billableJustExpired.length > 0) {
    results.push(`${billableJustExpired.length} subscription(s) in grace period`);
    for (const sub of billableJustExpired) {
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
