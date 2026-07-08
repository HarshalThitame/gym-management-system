import { createSupabaseServerClient } from "@/lib/supabase/server";
import { billingLogger } from "@/features/billing/lib/logger";

export type MemberLoyaltyData = {
  balance: number;
  recentTransactions: {
    id: string;
    points: number;
    source_type: string;
    description: string | null;
    created_at: string;
  }[];
  config: {
    points_per_check_in: number;
    points_per_referral: number;
    points_redemption_rate: number;
    min_points_to_redeem: number;
    max_redemption_percentage: number;
    is_active: boolean;
  } | null;
  leaderboard: {
    member_id: string;
    full_name: string;
    balance: number;
  }[];
};

export async function getMemberLoyaltyData(
  memberId: string,
  organizationId: string
): Promise<MemberLoyaltyData | null> {
  const supabase = await createSupabaseServerClient();

  const [pointsResult, configResult, leaderboardResult] = await Promise.all([
    supabase
      .from("loyalty_points")
      .select("id, points, source_type, description, created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("loyalty_points_config")
      .select("points_per_check_in, points_per_referral, points_redemption_rate, min_points_to_redeem, max_redemption_percentage, is_active")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .rpc("get_top_loyalty_members", { org_id: organizationId, limit_count: 10 })
  ]);

  if (pointsResult.error) {
    billingLogger.error("getMemberLoyaltyData", "Failed to fetch points", { memberId, error: pointsResult.error.message });
    return null;
  }

  if (configResult.error) {
    billingLogger.error("getMemberLoyaltyData", "Failed to fetch config", { organizationId, error: configResult.error.message });
  }

  if (leaderboardResult.error) {
    billingLogger.error("getMemberLoyaltyData", "Failed to fetch leaderboard", { organizationId, error: leaderboardResult.error.message });
  }

  const pointsRows = pointsResult.data ?? [];
  const configData = configResult.data;
  const leaderboardData = leaderboardResult.data;

  const balance = pointsRows.reduce((sum, row) => sum + (row.points ?? 0), 0);

  return {
    balance,
    recentTransactions: pointsRows.map((row) => ({
      id: row.id,
      points: row.points ?? 0,
      source_type: row.source_type ?? "adjustment",
      description: row.description ?? null,
      created_at: row.created_at ?? new Date().toISOString()
    })),
    config: configData ? {
      points_per_check_in: configData.points_per_check_in ?? 10,
      points_per_referral: configData.points_per_referral ?? 100,
      points_redemption_rate: configData.points_redemption_rate ?? 100,
      min_points_to_redeem: configData.min_points_to_redeem ?? 0,
      max_redemption_percentage: configData.max_redemption_percentage ?? 100,
      is_active: configData.is_active ?? false
    } : null,
    leaderboard: (leaderboardData ?? []) as MemberLoyaltyData["leaderboard"]
  };
}
