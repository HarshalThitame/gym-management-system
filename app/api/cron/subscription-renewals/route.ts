import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/services/email/resend";
import { subscriptionExpiryWarning } from "@/emails/subscription";
import { recordSubscriptionEvent } from "@/features/super-admin/services/subscription-events-service";

type DbSubRow = {
  id: string;
  organization_id: string;
  status: string;
  expires_at: string;
  package_id: string;
};

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

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

  const admin = supabase;
  const now = new Date();
  const results: string[] = [];

  const warningDays = [30, 14, 7, 3, 1];

  for (const days of warningDays) {
    const target = new Date(now);
    target.setDate(target.getDate() + days);
    const targetDate = target.toISOString().slice(0, 10);

    const db = admin as never as {
      from(t: string): {
        select(c: string): {
          eq(c: string, v: string): {
            gte(c: string, v: string): { lte(c: string, v: string): Promise<{ data: DbSubRow[] | null; error: { message: string } | null }> };
          };
        };
      };
    };

    const { data: expiring } = await db
      .from("organization_subscriptions")
      .select("")
      .eq("status", "active")
      .gte("expires_at", `${targetDate}T00:00:00.000Z`)
      .lte("expires_at", `${targetDate}T23:59:59.999Z`);

    if (!expiring || expiring.length === 0) continue;

    const orgIds = [...new Set(expiring.map((s) => s.organization_id))];

    const orgDb = admin as never as {
      from(t: string): {
        select(c: string): {
          in(c: string, v: string[]): Promise<{ data: Array<{ id: string; name: string; billing_email: string | null }> | null; error: { message: string } | null }>;
        };
      };
    };

    const { data: orgs } = await orgDb
      .from("organizations")
      .select("")
      .in("id", orgIds);

    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o]));

    const pkgIds = [...new Set(expiring.map((s) => s.package_id))];
    const pkgDb = admin as never as {
      from(t: string): {
        select(c: string): {
          in(c: string, v: string[]): Promise<{ data: Array<{ id: string; name: string }> | null; error: { message: string } | null }>;
        };
      };
    };
    const { data: pkgs } = await pkgDb.from("packages").select("").in("id", pkgIds);
    const pkgMap = new Map((pkgs ?? []).map((p) => [p.id, p.name]));

    let sent = 0;
    for (const sub of expiring) {
      const org = orgMap.get(sub.organization_id);
      if (!org?.billing_email) continue;
      const planName = pkgMap.get(sub.package_id) ?? "Current Plan";

      const result = await sendEmail({
        to: org.billing_email,
        subject: `Subscription expiring in ${days} day${days === 1 ? "" : "s"}`,
        html: subscriptionExpiryWarning({
          orgName: org.name,
          daysUntilExpiry: days,
          planName,
          expiresAt: sub.expires_at,
        }),
      });

      if (result.sent) {
        sent++;
        await recordSubscriptionEvent({
          organizationId: sub.organization_id,
          eventType: "renewal_reminder_sent" as never,
          reason: `${days}-day expiry reminder sent to ${org.billing_email}`,
          metadata: { daysRemaining: days, expiresAt: sub.expires_at },
        });
      }
    }

    if (sent > 0) {
      results.push(`Sent ${sent} ${days}-day expiry reminder(s)`);
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    actions: results.length > 0 ? results : ["No actions taken"],
  });
}
