import { createSupabaseServerClient } from "@/lib/supabase/server";
type Unwrap<T> = T extends Promise<infer U> ? U : T;
type SbClient = Unwrap<ReturnType<typeof createSupabaseServerClient>>;

export type SubscriptionAnalytics = {
  totalOrganizations: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  expiredSubscriptions: number;
  suspendedSubscriptions: number;
  cancelledSubscriptions: number;
  unassigned: number;
  activeChange: number;
  trialConversionRate: number;
  mrr: number;
  arr: number;
  revenueByPlan: Array<{ planName: string; count: number; mrr: number }>;
  addonMrr: number;
  totalAddonMrr: number;
  recentEvents: Array<{ eventType: string; count: number }>;
  subscriptionsOverMemberLimit: number;
  subscriptionsOverBranchLimit: number;
};

export async function getSubscriptionAnalytics(): Promise<SubscriptionAnalytics> {
  const supabase = await createSupabaseServerClient();
  const sbRaw = supabase as never as { from(t: string): { select(c: string): unknown } };

  const [orgsResult, subsResult, packagesResult, eventsResult] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("organization_subscriptions").select("id, status, package_id, dunning_attempts, organization_id"),
    supabase.from("packages").select("id, name, price, billing_period"),
    (sbRaw.from("subscription_events").select("event_type, created_at") as Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>),
  ]);

  const totalOrgs = orgsResult.count ?? 0;
  const subs = (subsResult.data ?? []) as unknown as Array<{
    id: string; status: string; package_id: string; dunning_attempts: number; organization_id: string;
  }>;
  const packages = (packagesResult.data ?? []) as unknown as Array<{
    id: string; name: string; price: number | null; billing_period: string | null;
  }>;

  const active = subs.filter((s) => s.status === "active");
  const trialing = subs.filter((s) => s.status === "trial");
  const expired = subs.filter((s) => s.status === "expired");
  const suspended = subs.filter((s) => s.status === "suspended");
  const cancelled = subs.filter((s) => s.status === "cancelled");
  const unassigned = totalOrgs - subs.length;

  const packageMap = new Map(packages.map((p) => [p.id, p]));
  const totalTrials = trialing.length + historyTrials(eventsResult);
  const convertedTrials = historyConversions(eventsResult);
  const trialConversionRate = totalTrials > 0 ? Math.round((convertedTrials / totalTrials) * 100) : 0;

  const mrr = calculateMrr(active, trialing, packageMap);

  const revenueByPlanMap = new Map<string, { count: number; mrr: number }>();
  for (const p of packages) {
    const planSubs = active.filter((s) => s.package_id === p.id);
    const planMrr = calculateMrrForPlan(planSubs, p);
    revenueByPlanMap.set(p.name, { count: planSubs.length, mrr: planMrr });
  }

  const events = (eventsResult.data ?? []) as unknown as Array<{ event_type: string; created_at: string }>;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const recentEventsMap = new Map<string, number>();
  for (const e of events) {
    if (e.created_at >= thirtyDaysAgo) {
      recentEventsMap.set(e.event_type, (recentEventsMap.get(e.event_type) ?? 0) + 1);
    }
  }

  const subsOverMember = await countOverLimits(supabase, "member");
  const subsOverBranch = await countOverLimits(supabase, "branch");

  const allAddonMrr = await computeAddonMrr(supabase);

  return {
    totalOrganizations: totalOrgs,
    activeSubscriptions: active.length,
    trialingSubscriptions: trialing.length,
    expiredSubscriptions: expired.length,
    suspendedSubscriptions: suspended.length,
    cancelledSubscriptions: cancelled.length,
    unassigned,
    activeChange: active.length - historyActiveChange(events, subs),
    trialConversionRate,
    mrr,
    arr: mrr * 12,
    revenueByPlan: Array.from(revenueByPlanMap.entries()).map(([planName, data]) => ({ planName, ...data })),
    addonMrr: Math.round(active.length > 0 ? allAddonMrr / active.length : 0),
    totalAddonMrr: allAddonMrr,
    recentEvents: Array.from(recentEventsMap.entries()).map(([eventType, count]) => ({ eventType, count })),
    subscriptionsOverMemberLimit: subsOverMember,
    subscriptionsOverBranchLimit: subsOverBranch,
  };
}

function calculateMrr(
  active: Array<Record<string, unknown>>,
  trialing: Array<Record<string, unknown>>,
  packageMap: Map<string, { id: string; name: string; price: number | null; billing_period: string | null }>
): number {
  let total = 0;
  for (const sub of [...active, ...trialing]) {
    const pkg = packageMap.get(sub.package_id as string);
    if (!pkg) continue;
    // Use price_override if set, otherwise fall back to package price
    const effectivePrice = (sub.price_override as number | null) ?? pkg.price;
    if (effectivePrice) {
      total += normalizeToMonthly(effectivePrice, pkg.billing_period);
    }
  }
  return total;
}

function calculateMrrForPlan(
  subs: Array<Record<string, unknown>>,
  pkg: { id: string; name: string; price: number | null; billing_period: string | null }
): number {
  let total = 0;
  if (pkg.price) {
    total += normalizeToMonthly(pkg.price, pkg.billing_period) * subs.length;
  }
  return total;
}

function normalizeToMonthly(price: number, period: string | null): number {
  switch (period) {
    case "quarterly": return Math.round(price / 3);
    case "half_yearly": return Math.round(price / 6);
    case "annual": return Math.round(price / 12);
    default: return price;
  }
}

function historyTrials(eventsResult: { data: unknown }): number {
  const events = (eventsResult.data ?? []) as Array<{ event_type: string }>;
  return events.filter((e) => e.event_type === "trial_started").length;
}

function historyConversions(eventsResult: { data: unknown }): number {
  const events = (eventsResult.data ?? []) as Array<{ event_type: string }>;
  return events.filter((e) => e.event_type === "trial_converted").length;
}

function historyActiveChange(
  events: Array<{ event_type: string; created_at: string }>,
  currentSubs: Array<{ status: string }>
): number {
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const newActive = events.filter(
    (e) => e.event_type === "trial_converted" || e.event_type === "reactivated"
  ).length;
  return Math.max(0, currentSubs.filter((s) => s.status === "active").length - newActive);
}

async function countOverLimits(
  supabase: SbClient,
  limitType: "member" | "branch"
): Promise<number> {
  try {
    const raw = supabase as never as {
      from(t: string): {
        select(c: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
      };
    };

    const { data: subs } = await raw.from("organization_subscriptions").select("id, organization_id, package_id, status");
    const { data: limitsData } = await raw.from("package_limits").select("package_id, limit_code, value");
    if (!subs || !limitsData) return 0;

    // Build limit map from package_limits (single source of truth)
    const limitMap = new Map<string, number>();
    for (const l of limitsData) {
      if ((l.limit_code as string) === (limitType === "member" ? "max_members" : "max_branches")) {
        limitMap.set(l.package_id as string, l.value as number);
      }
    }

    const activeSubs = subs.filter((s) => (s.status as string) === "active") as Array<{ organization_id: string; package_id: string }>;

    const orgIds = [...new Set(activeSubs.map((s) => s.organization_id))];

    let count = 0;

    for (const orgId of orgIds) {
      const orgSubs = activeSubs.filter((s) => s.organization_id === orgId);
      for (const sub of orgSubs) {
        const limit = limitMap.get(sub.package_id);
        if (limit === undefined || limit === -1) continue;

        let actualCount = 0;
        if (limitType === "member") {
          const rawProf = supabase as never as { from(t: string): { select(c: string, o: { count: "exact"; head: true }): { eq(c: string, v: string): Promise<{ count: number | null; error: { message: string } | null }> } } };
          const { count: memberCount } = await rawProf.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
          actualCount = memberCount ?? 0;
        } else {
          const rawGym = supabase as never as { from(t: string): { select(c: string, o: { count: "exact"; head: true }): { eq(c: string, v: string): { eq(c2: string, v2: string): Promise<{ count: number | null; error: { message: string } | null }> } } } };
          const { count: branchCount } = await rawGym.from("gyms").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active");
          actualCount = branchCount ?? 0;
        }

        if (actualCount > limit) count++;
      }
    }

    return count;
  } catch {
    return 0;
  }
}

async function computeAddonMrr(supabase: SbClient): Promise<number> {
  try {
    const raw = supabase as never as { from(t: string): { select(c: string): Promise<{ data: Array<{ unit_price: number; quantity: number }> | null }> } };
    const { data } = await raw.from("subscription_addons").select("unit_price, quantity");
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, a) => sum + (a.unit_price ?? 0) * (a.quantity ?? 0), 0);
  } catch {
    return 0;
  }
}
