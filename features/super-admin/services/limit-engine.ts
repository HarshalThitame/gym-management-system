/**
 * Central Limit Engine — single source of truth for all package limits.
 * Every module must use this engine. No direct limit checks anywhere else.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

export type OrgUsage = {
  memberCount: number;
  trainerCount: number;
  staffCount: number;
  gymCount: number;
  branchCount: number;
};

export type OrgLimit = {
  code: string;
  label: string;
  value: number;
};

export type LimitCheckResult = {
  ok: boolean;
  limit: number;
  usage: number;
  remaining: number;
  percentUsed: number;
  error?: string | undefined;
  upgradeSuggestion?: string | undefined;
};

const UPGRADE_SUGGESTIONS: Record<string, string> = {
  max_members: "Upgrade to Growth for 5,000 members or Enterprise for unlimited.",
  max_trainers: "Upgrade to Growth for 100 trainers or Enterprise for unlimited.",
  max_staff: "Upgrade to Growth for 50 staff or Enterprise for unlimited.",
  max_gyms: "Upgrade to Growth for 5 gyms or Enterprise for unlimited.",
  max_branches: "Upgrade to Growth for 10 branches or Enterprise for unlimited.",
  max_storage_gb: "Upgrade to Growth for 50 GB storage or Enterprise for unlimited.",
  max_api_calls: "Upgrade to Growth for 10K API calls or Enterprise for unlimited.",
  max_domains: "Upgrade to Enterprise for custom domains.",
  max_ai_requests: "Upgrade to Growth for AI features or Enterprise for unlimited.",
  max_sms_monthly: "Upgrade to Growth for SMS or Enterprise for unlimited.",
  max_emails_monthly: "Upgrade to Growth for more emails or Enterprise for unlimited.",
};

/**
 * Fetches all limit definitions for an organization's current package.
 */
export async function getOrganizationLimits(organizationId: string): Promise<OrgLimit[]> {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): {
          in(k: string, v: string[]): {
            order(k: string, o: { ascending: boolean }): {
              limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
  };

  const { data: subs } = await s
    .from("organization_subscriptions")
    .select("package_id")
    .eq("organization_id", organizationId)
    .in("status", ["active", "trial"])
    .order("started_at", { ascending: false } as never)
    .limit(1);

  const sub = (subs ?? [])[0];
  if (!sub) return [];

  const { data: limits } = await (s as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): {
          order(k: string, o: { ascending: boolean }): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
        };
      };
    };
  }).from("package_limits").select("limit_code, label, value").eq("package_id", sub.package_id as string).order("sort_order", { ascending: true });

  return ((limits ?? []) as Record<string, unknown>[]).map((l) => ({
    code: l.limit_code as string,
    label: l.label as string,
    value: l.value as number,
  }));
}

/**
 * Gets current usage counts from the cached organization_usage table.
 */
export async function getCurrentUsage(organizationId: string): Promise<OrgUsage> {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
      };
    };
  };

  const { data } = await s.from("organization_usage").select("member_count, trainer_count, staff_count, gym_count, branch_count").eq("organization_id", organizationId);

  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  return {
    memberCount: (row?.member_count as number) ?? 0,
    trainerCount: (row?.trainer_count as number) ?? 0,
    staffCount: (row?.staff_count as number) ?? 0,
    gymCount: (row?.gym_count as number) ?? 0,
    branchCount: (row?.branch_count as number) ?? 0,
  };
}

/**
 * Validates whether an organization can create more of a resource.
 * Checks current usage against the package limit.
 * Returns ok=false with upgrade suggestion if over limit.
 */
export async function validateLimit(
  organizationId: string,
  limitCode: string,
  additionalUsage: number = 1,
): Promise<LimitCheckResult> {
  const usage = await getCurrentUsage(organizationId);
  const limits = await getOrganizationLimits(organizationId);

  const usageMap: Record<string, number> = {
    max_members: usage.memberCount,
    max_trainers: usage.trainerCount,
    max_staff: usage.staffCount,
    max_gyms: usage.gymCount,
    max_branches: usage.branchCount,
  };

  const currentUsage = usageMap[limitCode] ?? 0;
  const limit = limits.find((l) => l.code === limitCode);
  const limitValue = limit?.value ?? -1;

  if (limitValue === -1) {
    return { ok: true, limit: -1, usage: currentUsage, remaining: -1, percentUsed: 0 };
  }

  const newUsage = currentUsage + additionalUsage;
  const remaining = Math.max(0, limitValue - currentUsage);
  const percentUsed = limitValue > 0 ? Math.round((currentUsage / limitValue) * 100) : 0;

  if (newUsage > limitValue) {
    return {
      ok: false,
      limit: limitValue,
      usage: currentUsage,
      remaining: 0,
      percentUsed: 100,
      error: `Your plan limits ${limit?.label ?? limitCode} to ${limitValue}. You currently have ${currentUsage}. ${UPGRADE_SUGGESTIONS[limitCode] ?? "Upgrade your plan for more capacity."}`,
      upgradeSuggestion: UPGRADE_SUGGESTIONS[limitCode],
    };
  }

  return { ok: true, limit: limitValue, usage: currentUsage, remaining, percentUsed };
}

/**
 * Refreshes usage counts for an org (calls the RPC).
 */
export async function refreshUsage(organizationId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await (supabase as never as { rpc(name: string, params: Record<string, unknown>): Promise<unknown> }).rpc("refresh_organization_usage", { p_organization_id: organizationId });
}

/**
 * Records a limit-related audit event.
 */
export async function recordUsageAudit(input: {
  organizationId: string;
  actorId?: string | null;
  eventType: string;
  limitCode?: string;
  currentValue?: number;
  limitValue?: number;
  reason?: string;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await (admin as never as { from(t: string): { insert(r: Record<string, unknown>): Promise<unknown> } })
    .from("usage_audit_logs")
    .insert({
      organization_id: input.organizationId,
      actor_id: input.actorId ?? null,
      event_type: input.eventType,
      limit_code: input.limitCode ?? null,
      current_value: input.currentValue ?? null,
      limit_value: input.limitValue ?? null,
      reason: input.reason ?? null,
    });

  await writeAuditLog({
    actorId: input.actorId ?? null,
    action: `limit.${input.eventType}`,
    entityType: "organization_subscription",
    entityId: input.organizationId,
    metadata: { limitCode: input.limitCode, currentValue: input.currentValue, limitValue: input.limitValue, reason: input.reason } as never,
  });
}

/**
 * Gets a comprehensive usage summary with limit states for dashboard display.
 */
export async function getUsageSummary(organizationId: string): Promise<{
  usage: OrgUsage;
  limits: Array<LimitCheckResult & { code: string; label: string }>;
  overLimitCount: number;
  warningCount: number;
  healthyCount: number;
}> {
  const usage = await getCurrentUsage(organizationId);
  const limits = await getOrganizationLimits(organizationId);

  const limitCodes = ["max_members", "max_trainers", "max_staff", "max_gyms", "max_branches"];
  const results: Array<LimitCheckResult & { code: string; label: string }> = [];

  for (const limit of limits) {
    if (!limitCodes.includes(limit.code)) continue;
    const result = await validateLimit(organizationId, limit.code);
    results.push({ ...result, code: limit.code, label: limit.label });
  }

  return {
    usage,
    limits: results,
    overLimitCount: results.filter((r) => !r.ok).length,
    warningCount: results.filter((r) => r.ok && r.percentUsed >= 80).length,
    healthyCount: results.filter((r) => r.ok && r.percentUsed < 80).length,
  };
}
