"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";
import { revalidateOrgModules } from "./action-utils";
import type { Database } from "@/types/database";

type LoyaltyConfig = Database["public"]["Tables"]["loyalty_points_config"]["Row"];
type LoyaltyPointRow = Database["public"]["Tables"]["loyalty_points"]["Row"];

// ─── Configuration ─────────────────────────────────────────────────────────

export async function getLoyaltyConfig(organizationId: string): Promise<LoyaltyConfig | null> {
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "loyalty_points_system", actionName: "loyalty.config.read" });
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("loyalty_points_config")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data ?? null;
}

export async function saveLoyaltyConfig(
  organizationId: string,
  data: {
    pointsPerCheckIn?: number;
    pointsPerRenewalPercentage?: number;
    pointsPerReferral?: number;
    pointsRedemptionRate?: number;
    minPointsToRedeem?: number;
    maxRedemptionPercentage?: number;
  }
): Promise<LoyaltyConfig> {
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "loyalty_points_system", actionName: "loyalty.config.save" });
  const supabase = await createSupabaseServerClient();

  const payload = {
    points_per_check_in: data.pointsPerCheckIn ?? 10,
    points_per_renewal_percentage: data.pointsPerRenewalPercentage ?? 5,
    points_per_referral: data.pointsPerReferral ?? 100,
    points_redemption_rate: data.pointsRedemptionRate ?? 100,
    min_points_to_redeem: data.minPointsToRedeem ?? 0,
    max_redemption_percentage: data.maxRedemptionPercentage ?? 100,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("loyalty_points_config")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabase
      .from("loyalty_points_config")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    revalidateOrgModules(["/organization/members"]);
    return updated;
  }

  const insertPayload = {
    organization_id: organizationId,
    ...payload,
  };

  const { data: created, error } = await supabase
    .from("loyalty_points_config")
    .insert(insertPayload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidateOrgModules(["/organization/members"]);
  return created;
}

// ─── Points engine (internal — no feature gate) ────────────────────────────

export async function earnPoints(
  organizationId: string,
  memberId: string,
  sourceType: "check_in" | "renewal" | "referral" | "purchase",
  sourceId?: string | null,
  description?: string | null,
  amountPaise?: number
): Promise<{ pointsEarned: number; newBalance: number }> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: config } = await supabase
      .from("loyalty_points_config")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!config || !config.is_active) {
      return { pointsEarned: 0, newBalance: await getBalance(supabase, memberId) };
    }

    let points = 0;
    if (sourceType === "check_in") {
      points = config.points_per_check_in;
    } else if (sourceType === "referral") {
      points = config.points_per_referral;
    } else if ((sourceType === "renewal" || sourceType === "purchase") && amountPaise != null) {
      const amountInr = Math.floor(amountPaise / 100);
      points = Math.floor(amountInr / 100) * config.points_per_renewal_percentage;
    }

    if (points <= 0) {
      return { pointsEarned: 0, newBalance: await getBalance(supabase, memberId) };
    }

    const { error } = await supabase.from("loyalty_points").insert({
      organization_id: organizationId,
      member_id: memberId,
      points,
      source_type: sourceType,
      source_id: sourceId ?? null,
      description: description ?? `${sourceType} points earned`,
    });

    if (error) {
      console.error("loyalty earnPoints insert error:", error.message);
      return { pointsEarned: 0, newBalance: await getBalance(supabase, memberId) };
    }

    revalidateOrgModules(["/organization/members"]);
    return { pointsEarned: points, newBalance: await getBalance(supabase, memberId) };
  } catch (e) {
    console.error("loyalty earnPoints error:", e instanceof Error ? e.message : String(e));
    return { pointsEarned: 0, newBalance: 0 };
  }
}

export async function redeemPoints(
  organizationId: string,
  memberId: string,
  pointsToRedeem: number,
  sourceId?: string | null,
  description?: string | null
): Promise<{ pointsRedeemed: number; newBalance: number; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    const balance = await getBalance(supabase, memberId);
    if (balance < pointsToRedeem) {
      return { pointsRedeemed: 0, newBalance: balance, error: "Insufficient points balance." };
    }

    const { data: config } = await supabase
      .from("loyalty_points_config")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!config || !config.is_active) {
      return { pointsRedeemed: 0, newBalance: balance, error: "Loyalty program is inactive." };
    }

    if (pointsToRedeem < config.min_points_to_redeem) {
      return { pointsRedeemed: 0, newBalance: balance, error: `Minimum ${config.min_points_to_redeem} points required to redeem.` };
    }

    const { error } = await supabase.from("loyalty_points").insert({
      organization_id: organizationId,
      member_id: memberId,
      points: -pointsToRedeem,
      source_type: "redemption",
      source_id: sourceId ?? null,
      description: description ?? `Redeemed ${pointsToRedeem} points`,
    });

    if (error) {
      console.error("loyalty redeemPoints insert error:", error.message);
      return { pointsRedeemed: 0, newBalance: balance, error: error.message };
    }

    const newBalance = await getBalance(supabase, memberId);
    revalidateOrgModules(["/organization/members"]);
    return { pointsRedeemed: pointsToRedeem, newBalance };
  } catch (e) {
    console.error("loyalty redeemPoints error:", e instanceof Error ? e.message : String(e));
    return { pointsRedeemed: 0, newBalance: 0, error: "Redemption failed." };
  }
}

export async function getMemberPointsBalance(organizationId: string, memberId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("loyalty_points")
    .select("points")
    .eq("organization_id", organizationId)
    .eq("member_id", memberId);
  return (data ?? []).reduce((sum, r) => sum + r.points, 0);
}

// ─── Reporting (feature-gated) ─────────────────────────────────────────────

export async function getPointsSummary(organizationId: string) {
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "loyalty_points_system", actionName: "loyalty.summary.read" });
  const supabase = await createSupabaseServerClient();

  const [earnedRes, redeemedRes, topRes, recentRes, bySourceRes, configRes] = await Promise.all([
    supabase.from("loyalty_points").select("points").eq("organization_id", organizationId).gt("points", 0),
    supabase.from("loyalty_points").select("points").eq("organization_id", organizationId).lt("points", 0),
    supabase.rpc("get_top_loyalty_members", { org_id: organizationId, limit_count: 10 }),
    supabase
      .from("loyalty_points")
      .select("id, member_id, points, source_type, description, created_at, members!inner(full_name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("loyalty_points").select("source_type, points").eq("organization_id", organizationId),
    supabase.from("loyalty_points_config").select("*").eq("organization_id", organizationId).maybeSingle(),
  ]);

  const totalPointsEarned = (earnedRes.data ?? []).reduce((sum, r) => sum + r.points, 0);
  const totalPointsRedeemed = (redeemedRes.data ?? []).reduce((sum, r) => sum + r.points, 0);
  const activePointsBalance = totalPointsEarned + totalPointsRedeemed; // redeemed is negative

  const topEarners = ((topRes.data as unknown[]) ?? []).map((r: unknown) => {
    const row = r as Record<string, unknown>;
    return {
      memberId: row.member_id as string,
      memberName: row.full_name as string,
      balance: row.balance as number,
    };
  });

  const recentActivity = ((recentRes.data as unknown[]) ?? []).map((r: unknown) => {
    const row = r as Record<string, unknown>;
    const member = (row.members as Record<string, unknown>) ?? {};
    return {
      id: row.id as string,
      memberId: row.member_id as string,
      memberName: (member.full_name as string) ?? "Unknown",
      points: row.points as number,
      sourceType: row.source_type as string,
      description: row.description as string,
      createdAt: row.created_at as string,
    };
  });

  const bySource = { check_in: 0, renewal: 0, referral: 0, purchase: 0, redemption: 0 };
  for (const r of (bySourceRes.data ?? [])) {
    const st = r.source_type as keyof typeof bySource;
    if (st in bySource) {
      bySource[st] += r.points;
    }
  }

  const pointsRedemptionRate = configRes.data?.points_redemption_rate ?? 100;

  return {
    totalPointsEarned,
    totalPointsRedeemed,
    activePointsBalance,
    totalRedeemableValue: Math.floor(activePointsBalance / pointsRedemptionRate),
    topEarners,
    recentActivity,
    bySource,
    config: configRes.data,
    pointsRedemptionRate,
  };
}

export async function getMemberPointsHistory(
  organizationId: string,
  memberId: string,
  page?: number,
  pageSize?: number
) {
  const supabase = await createSupabaseServerClient();
  const p = page ?? 1;
  const ps = pageSize ?? 20;
  const from = (p - 1) * ps;
  const to = from + ps - 1;

  const [txRes, balance] = await Promise.all([
    supabase
      .from("loyalty_points")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .range(from, to),
    getBalance(supabase, memberId),
  ]);

  return {
    transactions: (txRes.data ?? []) as LoyaltyPointRow[],
    total: txRes.count ?? 0,
    balance,
  };
}

export async function getPointsTransactionList(
  organizationId: string,
  filters?: {
    memberId?: string;
    sourceType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }
) {
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "loyalty_points_system", actionName: "loyalty.transactions.read" });
  const supabase = await createSupabaseServerClient();

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("loyalty_points")
    .select("id, member_id, points, source_type, source_id, description, created_at, members!inner(full_name)", { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters?.memberId) query = query.eq("member_id", filters.memberId);
  if (filters?.sourceType) query = query.eq("source_type", filters.sourceType as "check_in" | "renewal" | "referral" | "purchase" | "redemption" | "adjustment");
  if (filters?.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("created_at", filters.dateTo);

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const transactions = ((data as unknown[]) ?? []).map((r: unknown) => {
    const row = r as Record<string, unknown>;
    const member = (row.members as Record<string, unknown>) ?? {};
    return {
      id: row.id as string,
      memberId: row.member_id as string,
      memberName: (member.full_name as string) ?? "Unknown",
      points: row.points as number,
      sourceType: row.source_type as string,
      sourceId: row.source_id as string | null,
      description: row.description as string | null,
      createdAt: row.created_at as string,
    };
  });

  // Fetch balances for members appearing in the results
  const memberIds = [...new Set(transactions.map((t) => t.memberId))];
  const memberBalances: Record<string, number> = {};
  if (memberIds.length > 0) {
    const { data: balanceData } = await supabase
      .from("loyalty_points")
      .select("member_id, points")
      .eq("organization_id", organizationId)
      .in("member_id", memberIds);
    const balanceMap = new Map<string, number>();
    for (const r of (balanceData ?? [])) {
      balanceMap.set(r.member_id, (balanceMap.get(r.member_id) ?? 0) + r.points);
    }
    for (const [mid, bal] of balanceMap) {
      memberBalances[mid] = bal;
    }
  }

  return { transactions, total: count ?? 0, memberBalances };
}

// ─── Internal helpers ──────────────────────────────────────────────────────

async function getBalance(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, memberId: string): Promise<number> {
  const { data } = await supabase.from("loyalty_points").select("points").eq("member_id", memberId);
  return (data ?? []).reduce((sum, r) => sum + r.points, 0);
}
