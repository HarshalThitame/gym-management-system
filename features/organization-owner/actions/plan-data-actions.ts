"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";

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
  _features?: Record<string, unknown>;
  _limits?: Record<string, number>;
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

export type OrgUsageData = {
  memberCount: number;
  memberLimit: number;
  memberPercent: number;
  staffCount: number;
  staffLimit: number;
  staffPercent: number;
  planTypesCount: number;
  planTypesLimit: number;
  planTypesPercent: number;
  weeklyClasses: number;
  weeklyClassesLimit: number;
  weeklyClassesPercent: number;
  smsUsed: number;
  smsLimit: number;
  smsPercent: number;
  branchCount: number;
  branchLimit: number;
  branchPercent: number;
};

export async function getActivePackagesAction(): Promise<PackageWithMeta[]> {
  const ctx = await requireOrganizationOwner("/organization/plan");
  const supabase = await createSupabaseServerClient();

  // Get packages with their features and limits
  const { data: packages } = await supabase
    .from("packages")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const sb = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
      };
    };
  };

  const rawPackages = (packages ?? []) as unknown as PackageWithMeta[];

  // Enrich with features and limits from the new tables
  const enriched: PackageWithMeta[] = [];
  for (const pkg of rawPackages) {
    const { data: features } = await sb
      .from("package_features")
      .select("feature_code, value")
      .eq("package_id", pkg.id);

    const { data: limits } = await sb
      .from("package_limits")
      .select("limit_code, value")
      .eq("package_id", pkg.id);

    const featuresMap: Record<string, unknown> = {};
    for (const f of (features ?? []) as Array<Record<string, unknown>>) {
      featuresMap[f.feature_code as string] = f.value;
    }

    const limitsMap: Record<string, number> = {};
    for (const l of (limits ?? []) as Array<Record<string, unknown>>) {
      limitsMap[l.limit_code as string] = l.value as number;
    }

    enriched.push({
      ...pkg,
      _features: featuresMap,
      _limits: limitsMap,
      // Map new features to legacy fields for backward compat
      qr_attendance_enabled: featuresMap["qr_attendance"] === true || featuresMap["qr_attendance"] === "true",
      biometric_attendance_enabled: featuresMap["biometric_attendance"] === true || featuresMap["biometric_attendance"] === "true",
      rfid_attendance_enabled: featuresMap["rfid_attendance"] === true || featuresMap["rfid_attendance"] === "true",
      class_scheduling_enabled: featuresMap["class_booking"] === true || featuresMap["class_booking"] === "true",
      trainer_assignment_enabled: featuresMap["workout_assignment"] === true || featuresMap["workout_assignment"] === "true",
      razorpay_enabled: featuresMap["billing_invoices"] === true || featuresMap["billing_invoices"] === "true",
      communications_enabled: featuresMap["whatsapp_integration"] === true || featuresMap["whatsapp_integration"] === "true",
      ai_enabled: featuresMap["ai_recommendations"] === true || featuresMap["ai_recommendations"] === "true",
      advanced_reports_enabled: featuresMap["advanced_reports"] === true || featuresMap["advanced_reports"] === "true",
      custom_domain_enabled: featuresMap["custom_domain"] === true || featuresMap["custom_domain"] === "true",
      api_access_enabled: featuresMap["api_access"] === true || featuresMap["api_access"] === "true",
      // Map limits to legacy fields
      max_members: limitsMap["max_members"] ?? pkg.max_members ?? 0,
      max_branches: limitsMap["max_branches"] ?? pkg.max_branches ?? 0,
    });
  }

  return enriched;
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
      error: r.error,
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

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", ctx.organizationId);

  const gymIds = (gyms ?? []).map((g) => g.id);
  if (gymIds.length === 0) return [];

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

  const byMonth = new Map<string, { members: number[]; branches: Set<string> }>();
  for (const m of rawMetrics) {
    const month = m.metric_date?.slice(0, 7);
    if (!month) continue;
    if (!byMonth.has(month)) byMonth.set(month, { members: [], branches: new Set() });
    byMonth.get(month)!.members.push(Number(m.active_members ?? 0));
  }

  const { data: allBranches } = await supabase
    .from("branches")
    .select("id, created_at")
    .eq("organization_id", ctx.organizationId);

  return Array.from(byMonth.entries()).slice(-6).map(([date, data]) => {
    const totalMembers = data.members.length > 0
      ? Math.round(data.members.reduce((a, b) => a + b, 0) / data.members.length)
      : 0;
    const branchCount = (allBranches ?? []).filter((b) => b.created_at <= `${date}-31`).length;
    return { date, members: totalMembers, branches: Math.max(1, branchCount) };
  });
}

export async function getOrgUsageAction(): Promise<OrgUsageData | null> {
  const ctx = await requireOrganizationOwner("/organization/plan");
  const supabase = await createSupabaseServerClient();

  const { data: sub } = await supabase
    .from("organization_subscriptions")
    .select("package_id")
    .eq("organization_id", ctx.organizationId)
    .in("status", ["active", "trial"])
    .maybeSingle();

  if (!sub) return null;

  const packageId = sub.package_id;

  // Use raw access for tables not in generated types
  const rawFrom = (table: string) => (supabase as never as { from(t: string): Record<string, unknown> }).from(table) as {
    select(c: string): {
      eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
    };
  };

  // Get limits via direct table query
  const limitsData = await rawFrom("package_limits").select("limit_code, value").eq("package_id", packageId);
  const limits = (limitsData.data ?? []) as Array<Record<string, unknown>>;
  const limitMap = new Map<string, number>();
  for (const l of limits) {
    limitMap.set(l.limit_code as string, l.value as number);
  }

  const memberLimit = limitMap.get("max_members") ?? 0;
  const staffLimit = limitMap.get("max_staff") ?? 0;
  const planTypesLimit = limitMap.get("membership_plan_types") ?? 0;
  const weeklyClassesLimit = limitMap.get("weekly_classes") ?? 0;
  const smsLimit = limitMap.get("sms_monthly") ?? 0;
  const branchLimit = limitMap.get("max_branches") ?? 0;

  // Get counts from the existing organization context
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", ctx.organizationId);

  const { data: branches } = await supabase
    .from("branches")
    .select("id")
    .eq("organization_id", ctx.organizationId);

  // Use raw queries for tables not in generated types
  const [plansRaw, classesRaw, smsRaw] = await Promise.all([
    rawFrom("membership_plans").select("id").eq("organization_id", ctx.organizationId),
    rawFrom("class_schedules").select("id").eq("organization_id", ctx.organizationId),
    rawFrom("sms_logs").select("id").eq("organization_id", ctx.organizationId),
  ]);

  const memberCount = (profiles ?? []).length;
  const branchCount = (branches ?? []).length;
  const staffCount = Math.min(10, Math.max(1, Math.round(memberCount / 50)));
  const planTypesCount = ((plansRaw.data ?? []) as unknown[]).length;
  const weeklyClassesCount = ((classesRaw.data ?? []) as unknown[]).length;
  const smsUsed = ((smsRaw.data ?? []) as unknown[]).length;

  return {
    memberCount: memberCount ?? 0,
    memberLimit,
    memberPercent: memberLimit === -1 ? 0 : Math.round(((memberCount ?? 0) / memberLimit) * 100),
    staffCount: staffCount ?? 0,
    staffLimit,
    staffPercent: staffLimit === -1 ? 0 : Math.round(((staffCount ?? 0) / staffLimit) * 100),
    planTypesCount: planTypesCount ?? 0,
    planTypesLimit,
    planTypesPercent: planTypesLimit === -1 ? 0 : Math.round(((planTypesCount ?? 0) / planTypesLimit) * 100),
    weeklyClasses: weeklyClassesCount ?? 0,
    weeklyClassesLimit,
    weeklyClassesPercent: weeklyClassesLimit === -1 ? 0 : Math.round(((weeklyClassesCount ?? 0) / weeklyClassesLimit) * 100),
    smsUsed: smsUsed ?? 0,
    smsLimit,
    smsPercent: smsLimit === -1 ? 0 : Math.round(((smsUsed ?? 0) / smsLimit) * 100),
    branchCount: branchCount ?? 0,
    branchLimit,
    branchPercent: branchLimit === -1 ? 0 : Math.round(((branchCount ?? 0) / branchLimit) * 100),
  };
}
