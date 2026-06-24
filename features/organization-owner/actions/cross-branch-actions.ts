"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireOrgFeatureAccess,
  hasFeatureAccess,
  entitlementSimpleCatch,
  type FeatureKey,
} from "@/features/entitlement";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";

type AppSupabase = ReturnType<typeof createSupabaseServerClient> extends Promise<infer T> ? T : never;

export type AccessRule = Database["public"]["Tables"]["cross_branch_access_rules"]["Row"];
export type AccessLog = Database["public"]["Tables"]["cross_branch_access_logs"]["Row"];

export type CreateAccessRuleInput = {
  name: string;
  memberId?: string | null;
  fromBranchId?: string | null;
  toBranchId: string;
  isAllowed?: boolean;
  priority?: number;
};

export type UpdateAccessRuleInput = Partial<CreateAccessRuleInput> & {
  isActive?: boolean;
};

export type AccessLogsFilter = {
  memberId?: string;
  gymId?: string;
  decision?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

// ═══ RULE MANAGEMENT ═══

export async function getAccessRules(organizationId: string): Promise<AccessRule[]> {
  try {
    await requireOrgFeatureAccess(organizationId, "cross_branch_member_access");
  } catch (error) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cross_branch_access_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createAccessRule(
  organizationId: string,
  input: CreateAccessRuleInput
): Promise<AccessRule> {
  await requireOrgFeatureAccess(organizationId, "cross_branch_member_access");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cross_branch_access_rules")
    .insert({
      organization_id: organizationId,
      name: input.name,
      member_id: input.memberId ?? null,
      from_branch_id: input.fromBranchId ?? null,
      to_branch_id: input.toBranchId,
      is_allowed: input.isAllowed ?? true,
      priority: input.priority ?? 0,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/organization/branches");
  return data;
}

export async function updateAccessRule(
  organizationId: string,
  ruleId: string,
  input: UpdateAccessRuleInput
): Promise<AccessRule> {
  await requireOrgFeatureAccess(organizationId, "cross_branch_member_access");

  const supabase = await createSupabaseServerClient();
  const update: Database["public"]["Tables"]["cross_branch_access_rules"]["Update"] = { updated_at: new Date().toISOString() };

  if (input.name !== undefined) update.name = input.name;
  if (input.memberId !== undefined) update.member_id = input.memberId ?? null;
  if (input.fromBranchId !== undefined) update.from_branch_id = input.fromBranchId ?? null;
  if (input.toBranchId !== undefined) update.to_branch_id = input.toBranchId;
  if (input.isAllowed !== undefined) update.is_allowed = input.isAllowed;
  if (input.priority !== undefined) update.priority = input.priority;
  if (input.isActive !== undefined) update.is_active = input.isActive;

  const { data, error } = await supabase
    .from("cross_branch_access_rules")
    .update(update)
    .eq("id", ruleId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/organization/branches");
  return data;
}

export async function deleteAccessRule(
  organizationId: string,
  ruleId: string
): Promise<void> {
  await requireOrgFeatureAccess(organizationId, "cross_branch_member_access");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("cross_branch_access_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
  revalidatePath("/organization/branches");
}

// ═══ ACCESS EVALUATION (called from check-in — NOT gated with require) ═══

export type CrossBranchAccessResult = {
  allowed: boolean;
  ruleName?: string;
  ruleId?: string;
  reason?: string;
};

export async function evaluateCrossBranchAccess(
  organizationId: string,
  memberId: string,
  fromGymId: string | null,
  toGymId: string,
  memberBranchId?: string | null
): Promise<CrossBranchAccessResult> {
  if (!fromGymId || !toGymId || fromGymId === toGymId) {
    return { allowed: false, reason: "Same gym or missing gym context — no cross-branch needed." };
  }

  try {
    const featureEnabled = await hasFeatureAccess(organizationId, "cross_branch_member_access");
    if (!featureEnabled) {
      return { allowed: false, reason: "Feature not enabled" };
    }

    const supabase = await createSupabaseServerClient();

    const [rulesResult, branchResult] = await Promise.all([
      supabase
        .from("cross_branch_access_rules")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("branches")
        .select("id")
        .eq("gym_id", toGymId)
        .neq("status", "archived"),
    ]);

    const { data: rules, error } = rulesResult;

    if (error || !rules || rules.length === 0) {
      return { allowed: false, reason: "No active access rules configured" };
    }

    const targetGymBranchIds = new Set((branchResult.data ?? []).map((b) => b.id));

    for (const rule of rules) {
      if (rule.member_id && rule.member_id !== memberId) {
        continue;
      }

      if (rule.from_branch_id !== null && rule.from_branch_id !== (memberBranchId ?? null)) {
        continue;
      }

      if (!rule.to_branch_id || !targetGymBranchIds.has(rule.to_branch_id)) {
        continue;
      }

      if (rule.is_allowed) {
        return {
          allowed: true,
          ruleId: rule.id,
          ruleName: rule.name,
        };
      }

      return {
        allowed: false,
        ruleId: rule.id,
        ruleName: rule.name,
        reason: `Explicitly denied by rule "${rule.name}"`,
      };
    }

    return { allowed: false, reason: "No access rule matches" };
  } catch (error) {
    console.error("Cross-branch access evaluation failed:", error instanceof Error ? error.message : "Unknown error");
    return { allowed: false, reason: "Access evaluation error — defaulting to deny" };
  }
}

// ═══ ACCESS LOGS ═══

export async function getAccessLogs(
  organizationId: string,
  filters?: AccessLogsFilter
): Promise<{ logs: AccessLog[]; total: number }> {
  try {
    await requireOrgFeatureAccess(organizationId, "cross_branch_member_access");
  } catch {
    return { logs: [], total: 0 };
  }

  const supabase = await createSupabaseServerClient();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;

  let query = supabase
    .from("cross_branch_access_logs")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (filters?.memberId) query = query.eq("member_id", filters.memberId);
  if (filters?.gymId) query = query.eq("to_gym_id", filters.gymId);
  if (filters?.decision) query = query.eq("decision", filters.decision as "allowed" | "denied");
  if (filters?.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("created_at", filters.dateTo);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw new Error(error.message);
  return { logs: data ?? [], total: count ?? 0 };
}

export async function getCrossBranchCheckInsToday(
  organizationId: string
): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    const today = new Date().toISOString().slice(0, 10);
    const { count, error } = await supabase
      .from("cross_branch_access_logs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("decision", "allowed")
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lte("created_at", `${today}T23:59:59.999Z`);

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
