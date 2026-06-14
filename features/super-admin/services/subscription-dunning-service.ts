import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordSubscriptionEvent } from "./subscription-events-service";

export type DunningResult = {
  processed: number;
  succeeded: number;
  failed: number;
  suspended: number;
};

const MAX_DUNNING_ATTEMPTS = 3;
const DUNNING_RETRY_DAYS = [3, 5, 7];

type RawQuery = {
  select(c: string): RawFilter;
  update(r: Record<string, unknown>): RawFilter;
};

type RawFilter = {
  eq(c: string, v: unknown): RawFilter & Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
  lt(c: string, v: string): RawFilter;
  gt(c: string, v: number): RawFilter;
  single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};

type Db = {
  from(t: string): RawQuery;
};

export async function getSubscriptionsDueForDunning(): Promise<Array<{ id: string; organization_id: string; dunning_attempts: number }>> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as Db;
  const now = new Date().toISOString();

  const res = await db.from("organization_subscriptions").select("").eq("status", "active").lt("dunning_next_retry", now).gt("dunning_attempts", 0) as unknown as { data: Record<string, unknown>[] | null; error: { message: string } | null };

  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((r) => ({
    id: r.id as string,
    organization_id: r.organization_id as string,
    dunning_attempts: r.dunning_attempts as number,
  }));
}

export async function getActiveSubscriptionsForBilling(): Promise<Array<{ id: string; organization_id: string; next_billing_date: string | null; billing_email: string | null }>> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as Db;
  const now = new Date().toISOString();

  const res = await db.from("organization_subscriptions").select("").eq("status", "active").lt("next_billing_date", now) as unknown as { data: Record<string, unknown>[] | null; error: { message: string } | null };

  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((r) => ({
    id: r.id as string,
    organization_id: r.organization_id as string,
    next_billing_date: (r.next_billing_date as string | null) ?? null,
    billing_email: ((r.organizations as Record<string, unknown> | null)?.billing_email as string | null) ?? null,
  }));
}

export function getRetryDate(attempt: number): Date {
  const index = Math.min(attempt - 1, DUNNING_RETRY_DAYS.length - 1);
  const days = DUNNING_RETRY_DAYS[index] ?? 7;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export async function recordDunningFailure(subscriptionId: string, organizationId: string, errorMessage: string): Promise<{ suspended: boolean }> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as Db;

  const { data: sub } = await db.from("organization_subscriptions").select("").eq("id", subscriptionId).single() as unknown as { data: { dunning_attempts: number } | null; error: { message: string } | null };

  const currentAttempts = (sub?.dunning_attempts ?? 0) + 1;
  const nextRetry = currentAttempts >= MAX_DUNNING_ATTEMPTS ? null : getRetryDate(currentAttempts).toISOString();
  const shouldSuspend = currentAttempts >= MAX_DUNNING_ATTEMPTS;

  const updateData: Record<string, unknown> = {
    dunning_attempts: currentAttempts,
    dunning_next_retry: nextRetry,
  };

  if (shouldSuspend) {
    updateData.status = "suspended";
  }

  const { error: updateError } = await db.from("organization_subscriptions").update(updateData).eq("id", subscriptionId);
  if (updateError) throw new Error(updateError.message);

  await recordSubscriptionEvent({
    organizationId,
    subscriptionId,
    eventType: shouldSuspend ? "suspended" : "dunning_attempt",
    newState: { dunningAttempts: currentAttempts, nextRetry, suspended: shouldSuspend },
    reason: `Dunning attempt ${currentAttempts}/${MAX_DUNNING_ATTEMPTS} failed: ${errorMessage}`,
  });

  return { suspended: shouldSuspend };
}

export async function recordDunningSuccess(subscriptionId: string, organizationId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as Db;

  const { error } = await db.from("organization_subscriptions").update({
    dunning_attempts: 0,
    dunning_next_retry: null,
    status: "active",
  }).eq("id", subscriptionId);

  if (error) throw new Error(error.message);

  await recordSubscriptionEvent({
    organizationId,
    subscriptionId,
    eventType: "payment_recovered",
    newState: { dunningAttempts: 0 },
    reason: "Payment retry succeeded",
  });
}
