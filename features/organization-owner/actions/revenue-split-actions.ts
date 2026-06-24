"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess, hasFeatureAccess } from "@/features/entitlement";
import type { Database } from "@/types/database";

type SplitRuleRow = Database["public"]["Tables"]["revenue_split_rules"]["Row"];
type SplitLogRow = Database["public"]["Tables"]["revenue_split_logs"]["Row"];

export type SplitRule = SplitRuleRow;
export type SplitLog = SplitLogRow;

export type SplitRuleInput = {
  name: string;
  sourceBranchId: string;
  targetBranchId: string;
  splitPercentage: number;
  description?: string;
};

export type SplitLogFilters = {
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type BranchRevenueReport = {
  branchId: string;
  branchName: string;
  directRevenue: number;
  splitIn: number;
  splitOut: number;
  netRevenue: number;
  memberCount: number;
  attendanceCount: number;
};

async function gate(organizationId: string, actionName: string) {
  return requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "branch_revenue_split",
    actionName,
  });
}

export async function getSplitRules(organizationId: string): Promise<SplitRule[]> {
  const supabase = await createSupabaseServerClient();
  await gate(organizationId, "revenue_split.rules.list");

  const { data, error } = await supabase
    .from("revenue_split_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSplitRule(
  organizationId: string,
  input: SplitRuleInput
): Promise<SplitRule> {
  const supabase = await createSupabaseServerClient();
  await gate(organizationId, "revenue_split.rules.create");

  const pct = Number(input.splitPercentage);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error("Split percentage must be between 0 and 100.");
  }
  if (input.sourceBranchId === input.targetBranchId) {
    throw new Error("Source and target branches must be different.");
  }

  const { data: branches, error: branchError } = await supabase
    .from("branches")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", [input.sourceBranchId, input.targetBranchId]);

  if (branchError) throw new Error(branchError.message);
  if (!branches || branches.length !== 2) {
    throw new Error("Both branches must belong to your organization.");
  }

  const { data, error } = await supabase
    .from("revenue_split_rules")
    .insert({
      organization_id: organizationId,
      name: input.name,
      source_branch_id: input.sourceBranchId,
      target_branch_id: input.targetBranchId,
      split_percentage: pct,
      description: input.description ?? null,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("An active split rule already exists for this source-target pair.");
    }
    throw new Error(error.message);
  }
  return data;
}

export async function updateSplitRule(
  organizationId: string,
  ruleId: string,
  input: Partial<SplitRuleInput>
): Promise<SplitRule> {
  const supabase = await createSupabaseServerClient();
  await gate(organizationId, "revenue_split.rules.update");

  if (input.splitPercentage !== undefined) {
    const pct = Number(input.splitPercentage);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      throw new Error("Split percentage must be between 0 and 100.");
    }
  }

  const update: Database["public"]["Tables"]["revenue_split_rules"]["Update"] = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description;
  if (input.splitPercentage !== undefined) update.split_percentage = Number(input.splitPercentage);

  const { data, error } = await supabase
    .from("revenue_split_rules")
    .update(update)
    .eq("id", ruleId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSplitRule(
  organizationId: string,
  ruleId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await gate(organizationId, "revenue_split.rules.delete");

  const { error } = await supabase
    .from("revenue_split_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}

export async function toggleSplitRule(
  organizationId: string,
  ruleId: string,
  isActive: boolean
): Promise<SplitRule> {
  const supabase = await createSupabaseServerClient();
  await gate(organizationId, "revenue_split.rules.update");

  const { data, error } = await supabase
    .from("revenue_split_rules")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", ruleId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getSplitLogs(
  organizationId: string,
  filters?: SplitLogFilters
): Promise<{
  logs: SplitLog[];
  total: number;
  summary: { totalOriginal: number; totalSplit: number };
}> {
  const supabase = await createSupabaseServerClient();
  await gate(organizationId, "revenue_split.logs.list");

  let query = supabase
    .from("revenue_split_logs")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters?.branchId) {
    query = query.or(`source_branch_id.eq.${filters.branchId},target_branch_id.eq.${filters.branchId}`);
  }
  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const from = (page - 1) * pageSize;

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(error.message);

  const { data: allForSummary } = await supabase
    .from("revenue_split_logs")
    .select("original_amount, split_amount")
    .eq("organization_id", organizationId);

  const rows = allForSummary ?? [];
  const summary = {
    totalOriginal: rows.reduce((s, r) => s + (r.original_amount ?? 0), 0),
    totalSplit: rows.reduce((s, r) => s + (r.split_amount ?? 0), 0),
  };

  return { logs: data ?? [], total: count ?? 0, summary };
}

export async function getBranchRevenueReport(
  organizationId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<BranchRevenueReport[]> {
  const supabase = await createSupabaseServerClient();
  await gate(organizationId, "revenue_split.reports.view");

  const { data: branches, error: branchError } = await supabase
    .from("branches")
    .select("id, name, gym_id")
    .eq("organization_id", organizationId)
    .order("name");

  if (branchError) throw new Error(branchError.message);
  if (!branches || branches.length === 0) return [];

  const gymIds = [...new Set(branches.map((b) => b.gym_id).filter(Boolean))] as string[];

  let paymentQuery = supabase
    .from("payments")
    .select("amount, gym_id, branch_id")
    .eq("status", "paid");

  if (gymIds.length > 0) {
    paymentQuery = paymentQuery.in("gym_id", gymIds);
  } else {
    return branches.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      directRevenue: 0,
      splitIn: 0,
      splitOut: 0,
      netRevenue: 0,
      memberCount: 0,
      attendanceCount: 0,
    }));
  }

  if (dateFrom) paymentQuery = paymentQuery.gte("created_at", dateFrom);
  if (dateTo) paymentQuery = paymentQuery.lte("created_at", dateTo);

  const { data: payments, error: paymentError } = await paymentQuery;
  if (paymentError) throw new Error(paymentError.message);

  const processedPayments = payments ?? [];

  let splitQuery = supabase
    .from("revenue_split_logs")
    .select("source_branch_id, target_branch_id, split_amount, original_amount")
    .eq("organization_id", organizationId);

  if (dateFrom) splitQuery = splitQuery.gte("created_at", dateFrom);
  if (dateTo) splitQuery = splitQuery.lte("created_at", dateTo);

  const { data: splits, error: splitError } = await splitQuery;
  if (splitError) throw new Error(splitError.message);

  const processedSplits = splits ?? [];

  const gymToBranchPayment = new Map<string, string>();
  for (const b of branches) {
    if (b.gym_id) {
      gymToBranchPayment.set(b.gym_id, b.id);
    }
  }

  const directRevenueByBranch = new Map<string, number>();
  for (const p of processedPayments) {
    const branchId = p.branch_id ?? (p.gym_id ? gymToBranchPayment.get(p.gym_id) : null);
    if (branchId) {
      directRevenueByBranch.set(branchId, (directRevenueByBranch.get(branchId) ?? 0) + Number(p.amount ?? 0));
    }
  }

  const splitInByBranch = new Map<string, number>();
  const splitOutByBranch = new Map<string, number>();
  for (const s of processedSplits) {
    if (s.target_branch_id) {
      splitInByBranch.set(s.target_branch_id, (splitInByBranch.get(s.target_branch_id) ?? 0) + (s.split_amount ?? 0));
    }
    if (s.source_branch_id) {
      splitOutByBranch.set(s.source_branch_id, (splitOutByBranch.get(s.source_branch_id) ?? 0) + (s.split_amount ?? 0));
    }
  }

  let memberQuery = supabase
    .from("members")
    .select("branch_id, gym_id")
    .eq("status", "active");

  if (gymIds.length > 0) {
    memberQuery = memberQuery.in("gym_id", gymIds);
  }

  const { data: members } = await memberQuery;
  const processedMembers = members ?? [];

  const memberCountByBranch = new Map<string, number>();
  for (const m of processedMembers) {
    const bid = m.branch_id ?? (m.gym_id ? gymToBranchPayment.get(m.gym_id) : null);
    if (bid) {
      memberCountByBranch.set(bid, (memberCountByBranch.get(bid) ?? 0) + 1);
    }
  }

  let attendanceQuery = supabase
    .from("attendance_logs")
    .select("gym_id");

  if (gymIds.length > 0) {
    attendanceQuery = attendanceQuery.in("gym_id", gymIds);
  }
  if (dateFrom) attendanceQuery = attendanceQuery.gte("occurred_at", dateFrom);
  if (dateTo) attendanceQuery = attendanceQuery.lte("occurred_at", dateTo);

  const { data: attendance } = await attendanceQuery;
  const processedAttendance = attendance ?? [];

  const attendanceCountByBranch = new Map<string, number>();
  for (const a of processedAttendance) {
    if (a.gym_id) {
      const bid = gymToBranchPayment.get(a.gym_id);
      if (bid) {
        attendanceCountByBranch.set(bid, (attendanceCountByBranch.get(bid) ?? 0) + 1);
      }
    }
  }

  return branches.map((b) => {
    const direct = directRevenueByBranch.get(b.id) ?? 0;
    const splitIn = splitInByBranch.get(b.id) ?? 0;
    const splitOut = splitOutByBranch.get(b.id) ?? 0;
    return {
      branchId: b.id,
      branchName: b.name,
      directRevenue: direct,
      splitIn,
      splitOut,
      netRevenue: direct + splitIn - splitOut,
      memberCount: memberCountByBranch.get(b.id) ?? 0,
      attendanceCount: attendanceCountByBranch.get(b.id) ?? 0,
    };
  });
}

export async function applySplitRules(
  organizationId: string,
  paymentId: string,
  paymentAmount: number,
  gymId: string | null
): Promise<void> {
  if (!paymentId || paymentAmount <= 0) return;
  if (!gymId) return;

  const featureAccessible = await hasFeatureAccess(organizationId, "branch_revenue_split").catch(() => false);
  if (!featureAccessible) return;

  const supabase = await createSupabaseServerClient();

  let branchId: string | null = null;

  const { data: payment } = await supabase
    .from("payments")
    .select("branch_id")
    .eq("id", paymentId)
    .maybeSingle();

  if (payment?.branch_id) {
    branchId = payment.branch_id;
  } else {
    const { data: branch } = await supabase
      .from("branches")
      .select("id")
      .eq("gym_id", gymId)
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    branchId = branch?.id ?? null;
  }

  if (!branchId) return;

  const { data: rules, error: rulesError } = await supabase
    .from("revenue_split_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("source_branch_id", branchId)
    .eq("is_active", true);

  if (rulesError || !rules || rules.length === 0) return;

  const amount = Math.round(paymentAmount);

  const logs: Database["public"]["Tables"]["revenue_split_logs"]["Insert"][] = [];
  for (const rule of rules) {
    const pct = Number(rule.split_percentage);
    const splitAmt = Math.round(amount * (pct / 100));
    if (splitAmt <= 0) continue;
    logs.push({
      organization_id: organizationId,
      payment_id: paymentId,
      source_branch_id: rule.source_branch_id,
      target_branch_id: rule.target_branch_id,
      original_amount: amount,
      split_amount: splitAmt,
      split_percentage: pct,
      rule_id: rule.id,
    });
  }

  if (logs.length > 0) {
    await supabase.from("revenue_split_logs").insert(logs);
  }
}
