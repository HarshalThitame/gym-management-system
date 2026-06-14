"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import type { Database } from "@/types/database";

export type PackageWithMeta = {
  id: string;
  name: string;
  description: string | null;
  max_members: number;
  max_branches: number;
  is_active: boolean;
  sort_order: number;
  qr_attendance_enabled: boolean;
  biometric_attendance_enabled: boolean;
  rfid_attendance_enabled: boolean;
  class_scheduling_enabled: boolean;
  trainer_assignment_enabled: boolean;
  razorpay_enabled: boolean;
  communications_enabled: boolean;
  ai_enabled: boolean;
  advanced_reports_enabled: boolean;
  custom_domain_enabled: boolean;
  api_access_enabled: boolean;
  price: number;
  billing_period: string;
  currency: string;
  recommended: boolean;
};

export type SubscriptionWithPackage = {
  id: string;
  organization_id: string;
  package_id: string;
  status: string;
  trial_ends_at: string | null;
  started_at: string;
  expires_at: string | null;
  auto_renew: boolean;
  package: PackageWithMeta;
};

export async function getActivePackagesAction(): Promise<PackageWithMeta[]> {
  const ctx = await requireOrganizationOwner("/organization/plan");
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("packages")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .then((r) => ({
      data: (r.data ?? []) as unknown as PackageWithMeta[],
      error: r.error
    }));

  return data ?? [];
}

export async function getOrgSubscriptionAction(): Promise<SubscriptionWithPackage | null> {
  const ctx = await requireOrganizationOwner("/organization/plan");
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("organization_subscriptions")
    .select("*, package:packages(*)")
    .eq("organization_id", ctx.organizationId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .then((r) => ({
      data: r.data as unknown as SubscriptionWithPackage | null,
      error: r.error
    }));

  return data ?? null;
}

export type UsageHistoryPoint = {
  date: string;
  members: number;
  branches: number;
};

export async function getUsageHistoryAction(): Promise<UsageHistoryPoint[]> {
  const ctx = await requireOrganizationOwner("/organization/plan");
  const supabase = await createSupabaseServerClient();

  // Get gym IDs for this organization
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", ctx.organizationId);

  const gymIds = (gyms ?? []).map((g) => g.id);
  if (gymIds.length === 0) return [];

  // Fetch branch metrics for the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: metrics } = await supabase
    .from("branch_metrics" as never)
    .select("metric_date, active_members")
    .in("gym_id", gymIds)
      .gte("metric_date" as never, sixMonthsAgo.toISOString().slice(0, 10))
    .order("metric_date" as never, { ascending: true })
    .limit(200) as never;

  const rawMetrics = (metrics ?? []) as Array<{ metric_date: string; active_members: number }>;

  // Aggregate by month
  const byMonth = new Map<string, { members: number[]; branches: Set<string> }>();
  for (const m of rawMetrics) {
    const month = m.metric_date?.slice(0, 7);
    if (!month) continue;
    if (!byMonth.has(month)) byMonth.set(month, { members: [], branches: new Set() });
    byMonth.get(month)!.members.push(Number(m.active_members ?? 0));
  }

  // Get branch count per gym per month
  const { data: allBranches } = await supabase
    .from("branches")
    .select("id, created_at")
    .eq("organization_id", ctx.organizationId);

  return Array.from(byMonth.entries()).slice(-6).map(([date, data]) => {
    const totalMembers = data.members.length > 0 ? Math.round(data.members.reduce((a, b) => a + b, 0) / data.members.length) : 0;
    const branchCount = (allBranches ?? []).filter((b) => b.created_at <= `${date}-31`).length;
    return { date, members: totalMembers, branches: Math.max(1, branchCount) };
  });
}
