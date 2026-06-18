import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { processExpiredTrials } from "@/features/super-admin/services/subscription-trial-service";
import { sendEmail } from "@/services/email/resend";
import { trialStartingReminder } from "@/emails/subscription";
import { recordSubscriptionEvent } from "@/features/super-admin/services/subscription-events-service";

type DbOrg = {
  id: string;
  name: string;
};

type DbSubRow = {
  id: string;
  organization_id: string;
  status: string;
  trial_ends_at: string;
  package_id: string;
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

  const admin = supabase;
  const now = new Date();
  const results: string[] = [];

  // Step 1: Process expired trials (trial_ends_at < now, status = trial)
  const { expired: expiredCount } = await processExpiredTrials();
  if (expiredCount > 0) {
    results.push(`Expired ${expiredCount} trial(s)`);
  }

  // Step 2: Send reminders for trials ending in 7, 3, and 1 days
  for (const days of [7, 3, 1]) {
    const target = new Date(now);
    target.setDate(target.getDate() + days);
    const targetDate = target.toISOString().slice(0, 10);

    type SelectResult =
      & { eq(c: string, v: string): EqResult }
      & { in(c: string, v: string[]): Promise<{ data: DbOrg[] | null; error: { message: string } | null }> }
      & { maybeSingle(): Promise<{ data: { billing_email: string | null } | null; error: { message: string } | null }> };

    type EqResult =
      & { gte(c: string, v: string): { lte(c: string, v: string): Promise<{ data: DbSubRow[] | null; error: { message: string } | null }> } }
      & { in(c: string, v: string[]): Promise<{ data: DbOrg[] | null; error: { message: string } | null }> }
      & { maybeSingle(): Promise<{ data: { billing_email: string | null } | null; error: { message: string } | null }> };

    const adminDb = admin as never as {
      from(t: string): { select(c: string): SelectResult };
    };

    const { data: expiring } = await adminDb
      .from("organization_subscriptions")
      .select("")
      .eq("status", "trial")
      .gte("trial_ends_at", `${targetDate}T00:00:00.000Z`)
      .lte("trial_ends_at", `${targetDate}T23:59:59.999Z`);

    if (!expiring || expiring.length === 0) continue;

    const orgIds = [...new Set(expiring.map((s) => s.organization_id))];

    const { data: orgs } = await adminDb
      .from("organizations")
      .select("")
      .in("id", orgIds);

    const orgMap = new Map((orgs ?? []).map((o: DbOrg) => [o.id, o.name]));

    const pkgIds = [...new Set(expiring.map((s) => s.package_id))];
    const { data: pkgs } = await adminDb
      .from("packages")
      .select("")
      .in("id", pkgIds);
    const pkgMap = new Map((pkgs ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

    let sent = 0;
    for (const sub of expiring) {
      const orgName = orgMap.get(sub.organization_id) ?? "Your organization";
      const planName = pkgMap.get(sub.package_id) ?? "Current Plan";

      const { data: org } = await adminDb
        .from("organizations")
        .select("")
        .eq("id", sub.organization_id)
        .maybeSingle();

      const billingEmail = org?.billing_email;
      if (!billingEmail) continue;

      const result = await sendEmail({
        to: billingEmail,
        subject: `Trial ending in ${days} day${days === 1 ? "" : "s"}`,
        html: trialStartingReminder({
          orgName,
          daysLeft: days,
          trialEndsAt: sub.trial_ends_at,
          planName,
        }),
      });

      if (result.sent) {
        sent++;
        await recordSubscriptionEvent({
          organizationId: sub.organization_id,
          eventType: "trial_reminder_sent",
          reason: `${days}-day trial reminder sent to ${billingEmail}`,
          metadata: { daysRemaining: days },
        });
      }
    }

    if (sent > 0) {
      results.push(`Sent ${sent} ${days}-day trial reminder(s)`);
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    actions: results.length > 0 ? results : ["No actions taken"],
  });
}

