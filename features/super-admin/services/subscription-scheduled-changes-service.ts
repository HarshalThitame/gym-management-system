import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordSubscriptionEvent } from "./subscription-events-service";
import { syncSubscriptionArtifactsForOrganization } from "./subscription-entitlement-sync";

export type ScheduledChange = {
  id: string;
  subscriptionId: string;
  fromPackageId: string;
  toPackageId: string;
  fromPackageName: string;
  toPackageName: string;
  effectiveDate: string;
  changeType: "upgrade" | "downgrade" | "crossgrade";
  status: "pending" | "applied" | "cancelled" | "failed";
  reason: string | null;
  createdBy: string | null;
};

type QueryRes = Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
type SingleRes = Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;

type Q = {
  select(c: string): Q & QueryRes;
  insert(r: Record<string, unknown>): Q & SingleRes;
  update(r: Record<string, unknown>): Q & QueryRes;
  eq(c: string, v: string): Q & QueryRes;
  maybeSingle(): SingleRes;
  single(): SingleRes;
  lt(c: string, v: string): QueryRes;
};

type Db = {
  from(t: string): Q;
};

export async function schedulePlanChange(input: {
  subscriptionId: string;
  organizationId: string;
  fromPackageId: string;
  toPackageId: string;
  changeType: "upgrade" | "downgrade" | "crossgrade";
  effectiveDate: Date;
  reason?: string;
  createdBy: string;
}): Promise<ScheduledChange> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as Db;

  const { data, error } = await db
    .from("scheduled_plan_changes")
    .insert({
      subscription_id: input.subscriptionId,
      from_package_id: input.fromPackageId,
      to_package_id: input.toPackageId,
      change_type: input.changeType,
      effective_date: input.effectiveDate.toISOString(),
      reason: input.reason ?? null,
      created_by: input.createdBy,
    })
    .select("")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to schedule plan change.");

  await db.from("organization_subscriptions").update({ scheduled_change_id: data.id }).eq("id", input.subscriptionId);

  await recordSubscriptionEvent({
    organizationId: input.organizationId,
    subscriptionId: input.subscriptionId,
    eventType: input.changeType === "downgrade" ? "downgrade_scheduled" : "plan_changed",
    newState: { scheduledChangeId: data.id, toPackageId: input.toPackageId, effectiveDate: input.effectiveDate.toISOString() },
    actorId: input.createdBy,
    reason: input.reason ?? null,
  });

  return {
    id: data.id as string,
    subscriptionId: data.subscription_id as string,
    fromPackageId: data.from_package_id as string,
    toPackageId: data.to_package_id as string,
    fromPackageName: "",
    toPackageName: "",
    effectiveDate: data.effective_date as string,
    changeType: data.change_type as ScheduledChange["changeType"],
    status: data.status as ScheduledChange["status"],
    reason: data.reason as string | null,
    createdBy: data.created_by as string | null,
  };
}

export async function cancelScheduledChange(changeId: string, organizationId: string, actorId: string, reason: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as Db;

  const { data: change } = await db
    .from("scheduled_plan_changes")
    .select("")
    .eq("id", changeId)
    .eq("status", "pending")
    .maybeSingle();

  if (!change) throw new Error("Scheduled change not found or already applied.");

  const { error } = await db
    .from("scheduled_plan_changes")
    .update({ status: "cancelled" })
    .eq("id", changeId);

  if (error) throw new Error(error.message);

  await db
    .from("organization_subscriptions")
    .update({ scheduled_change_id: null })
    .eq("id", change.subscription_id as string);

  await recordSubscriptionEvent({
    organizationId,
    subscriptionId: change.subscription_id as string,
    eventType: "downgrade_cancelled",
    previousState: { scheduledChangeId: changeId },
    actorId,
    reason,
  });
}

export async function applyScheduledChanges(): Promise<{ applied: number }> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as Db;
  const now = new Date().toISOString();

  const { data: pending } = await db
    .from("scheduled_plan_changes")
    .select("")
    .eq("status", "pending")
    .lt("effective_date", now);

  const changes = pending ?? [];
  let applied = 0;

  for (const change of changes) {
    try {
      const { error: updateError } = await db
        .from("organization_subscriptions")
        .update({ package_id: change.to_package_id as string, scheduled_change_id: null })
        .eq("id", change.subscription_id as string);

      if (updateError) throw new Error(updateError.message);

      await db
        .from("scheduled_plan_changes")
        .update({ status: "applied", applied_at: now })
        .eq("id", change.id as string);

      const { data: subscription } = await db
        .from("organization_subscriptions")
        .select("")
        .eq("id", change.subscription_id as string)
        .single();
      if (subscription?.organization_id) {
        await syncSubscriptionArtifactsForOrganization(
          subscription.organization_id as string,
          `Scheduled plan change applied for subscription ${change.subscription_id as string}.`,
        );
      }

      applied++;
    } catch {
      await db
        .from("scheduled_plan_changes")
        .update({ status: "failed", failure_reason: "Unknown error" })
        .eq("id", change.id as string);
    }
  }

  return { applied };
}
