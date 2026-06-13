import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordSubscriptionEvent } from "./subscription-events-service";
import type { SubscriptionEventType } from "./subscription-events-service";

export type TrialOrg = {
  organizationId: string;
  organizationName: string;
  subscriptionId: string;
  trialEndsAt: string;
  daysRemaining: number;
  billingEmail: string | null;
};

export async function getTrialingOrganizations(): Promise<TrialOrg[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .select("id, organization_id, trial_ends_at, organizations!inner(name, billing_email)")
    .eq("status", "trial")
    .order("trial_ends_at", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<{
    id: string; organization_id: string; trial_ends_at: string | null;
    organizations: { name: string; billing_email: string | null };
  }>)
    .filter((r) => r.trial_ends_at)
    .map((r) => ({
      organizationId: r.organization_id,
      organizationName: r.organizations.name,
      subscriptionId: r.id,
      trialEndsAt: r.trial_ends_at!,
      daysRemaining: Math.max(0, Math.ceil((new Date(r.trial_ends_at!).getTime() - Date.now()) / 86400000)),
      billingEmail: r.organizations.billing_email,
    }));
}

export async function processExpiredTrials(): Promise<{ expired: number }> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data: expired, error: selectError } = await supabase
    .from("organization_subscriptions")
    .select("id, organization_id")
    .eq("status", "trial")
    .lt("trial_ends_at", now);

  if (selectError) throw new Error(selectError.message);

  const rows = (expired ?? []) as Array<{ id: string; organization_id: string }>;
  if (rows.length === 0) return { expired: 0 };

  const ids = rows.map((r) => r.id);

  const { error: updateError } = await supabase
    .from("organization_subscriptions")
    .update({ status: "expired" })
    .in("id", ids);

  if (updateError) throw new Error(updateError.message);

  for (const row of rows) {
    await recordSubscriptionEvent({
      organizationId: row.organization_id,
      subscriptionId: row.id,
      eventType: "trial_expired",
      newState: { status: "expired" },
      reason: "Trial period ended",
    });
  }

  return { expired: rows.length };
}

export async function getTrialReminderOrgs(daysBefore: number): Promise<TrialOrg[]> {
  const all = await getTrialingOrganizations();
  return all.filter((o) => o.daysRemaining === daysBefore);
}

export async function convertTrialToPaid(
  subscriptionId: string,
  packageId: string,
  actorId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("organization_subscriptions")
    .select("id, organization_id, package_id")
    .eq("id", subscriptionId)
    .single();

  if (!existing) throw new Error("Subscription not found.");

  const prevPackageId = (existing as unknown as { package_id: string }).package_id;

  const { error } = await supabase
    .from("organization_subscriptions")
    .update({
      package_id: packageId,
      status: "active",
      trial_ends_at: null,
      started_at: now,
    })
    .eq("id", subscriptionId);

  if (error) throw new Error(error.message);

  await recordSubscriptionEvent({
    organizationId: (existing as unknown as { organization_id: string }).organization_id,
    subscriptionId,
    eventType: "trial_converted",
    previousState: { status: "trial", package_id: prevPackageId },
    newState: { status: "active", package_id: packageId },
    actorId,
    reason: "Trial converted to paid subscription",
  });
}
