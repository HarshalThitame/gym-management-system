"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";
import type { Database } from "@/types/database";

type ReferralConfigRow = Database["public"]["Tables"]["referral_program_config"]["Row"];
type ReferralRewardRow = Database["public"]["Tables"]["referral_rewards"]["Row"];

// ─── Program config ────────────────────────────────────────────────────────

export async function getReferralConfig(organizationId: string): Promise<ReferralConfigRow | null> {
  try {
    await requireOrganizationFeatureAccess({ organizationId, featureKey: "referral_program", actionName: "referral.config.read" });
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("referral_program_config")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();
    return data ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load referral config.";
    throw new Error(msg);
  }
}

export async function saveReferralConfig(
  organizationId: string,
  data: { rewardType: string; rewardValue: number; minMembershipDays?: number; maxRewards?: number; isActive?: boolean }
): Promise<ReferralConfigRow> {
  try {
    await requireOrganizationFeatureAccess({ organizationId, featureKey: "referral_program", actionName: "referral.config.save" });
    const supabase = await createSupabaseServerClient();

    const payload = {
      organization_id: organizationId,
      reward_type: data.rewardType as "discount" | "credit" | "free_month",
      reward_value: data.rewardValue,
      min_membership_days: data.minMembershipDays ?? 30,
      max_rewards_per_referrer: data.maxRewards ?? 0,
      is_active: data.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("referral_program_config")
      .select("id")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabase
        .from("referral_program_config")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      revalidateOrgModules(["/organization/members"]);
      return updated;
    }

    const { data: created, error } = await supabase
      .from("referral_program_config")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    revalidateOrgModules(["/organization/members"]);
    return created;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save referral config.";
    throw new Error(msg);
  }
}

// ─── Referral code generation ──────────────────────────────────────────────

export async function generateReferralCode(memberId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const res = await supabase.from("members").select("id, full_name, referral_code").eq("id", memberId);

  if (res.error) throw new Error(res.error.message);
  const rows = res.data ?? [];
  if (rows.length === 0) throw new Error("Member not found.");

  const member = rows[0] as Record<string, unknown>;
  if (member.referral_code) return member.referral_code as string;

  const fullName: string = (member.full_name as string) || "MEMBER";
  const firstName = fullName.split(" ")[0] ?? "";
  const namePart: string = firstName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "MEMBER";
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `${namePart}-${suffix}`;

  const { error: updateErr } = await supabase
    .from("members")
    .update({ referral_code: code, updated_at: new Date().toISOString() })
    .eq("id", memberId);

  if (updateErr) {
    // Retry with different suffix if duplicate
    if (updateErr.code === "23505") {
      const retrySuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const retryCode = `${namePart}-${retrySuffix}`;
      const { error: retryError } = await supabase
        .from("members")
        .update({ referral_code: retryCode, updated_at: new Date().toISOString() })
        .eq("id", memberId);
      if (retryError) throw new Error(retryError.message);
      return retryCode;
    }
    throw new Error(updateErr.message);
  }

  return code;
}

// ─── Referral stats ────────────────────────────────────────────────────────

export async function getReferralStats(organizationId: string) {
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "referral_program", actionName: "referral.stats.read" });
  const supabase = await createSupabaseServerClient();

  const [totalRes, earnedRes, paidRes, earnedAllRes, recentRes, configRes] = await Promise.all([
    supabase.from("referral_rewards").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("referral_rewards").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "earned"),
    supabase.from("referral_rewards").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "paid"),
    supabase
      .from("referral_rewards")
      .select("referrer_id, ...referrer:members!referrer_id(full_name)")
      .eq("organization_id", organizationId)
      .eq("status", "earned"),
    supabase
      .from("referral_rewards")
      .select("id, referrer_id, referred_member_id, status, reward_type, reward_value, created_at, ...referrer:members!referrer_id(full_name), ...referred:members!referred_member_id(full_name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("referral_program_config").select("*").eq("organization_id", organizationId).maybeSingle(),
  ]);

  // Aggregate top referrers in JS
  const referrerMap = new Map<string, { member_id: string; full_name: string; referral_count: number; rewards_earned: number }>();
  for (const r of (earnedAllRes.data as unknown[] | null) ?? []) {
    const row = r as Record<string, unknown>;
    const rid = row.referrer_id as string;
    const referrer = (row.referrer as Record<string, unknown> | null) ?? {};
    const existing = referrerMap.get(rid);
    if (existing) {
      existing.referral_count++;
      existing.rewards_earned++;
    } else {
      referrerMap.set(rid, {
        member_id: rid,
        full_name: (referrer.full_name as string) ?? "Unknown",
        referral_count: 1,
        rewards_earned: 1,
      });
    }
  }
  const topReferrers = [...referrerMap.values()]
    .sort((a, b) => b.referral_count - a.referral_count)
    .slice(0, 10);

  // Parse recent referrals with joined data
  const recentReferrals = ((recentRes.data as unknown[]) ?? []).map((r: unknown) => {
    const row = r as Record<string, unknown>;
    const referrer = (row.referrer as Record<string, unknown>) ?? {};
    const referred = (row.referred as Record<string, unknown>) ?? {};
    return {
      id: row.id as string,
      referrerName: (referrer.full_name as string) ?? "Unknown",
      referredName: (referred.full_name as string) ?? "Unknown",
      date: row.created_at as string,
      status: row.status as string,
      rewardType: row.reward_type as string,
      rewardValue: row.reward_value as number,
    };
  });

  return {
    totalReferrals: totalRes.count ?? 0,
    totalRewardsEarned: earnedRes.count ?? 0,
    totalRewardsPaid: paidRes.count ?? 0,
    topReferrers,
    recentReferrals,
    config: configRes.data ?? null,
  };
}

// ─── Referral list ─────────────────────────────────────────────────────────

export async function getReferralList(
  organizationId: string,
  filters?: { referrerId?: string; status?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }
) {
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "referral_program", actionName: "referral.list.read" });
  const supabase = await createSupabaseServerClient();

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("referral_rewards")
    .select("id, referrer_id, referred_member_id, reward_type, reward_value, status, earned_at, paid_at, expiry_date, membership_id, notes, created_at, ...referrer:members!referrer_id(full_name), ...referred:members!referred_member_id(full_name)", { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters?.referrerId) query = query.eq("referrer_id", filters.referrerId);
  if (filters?.status) query = query.eq("status", filters.status as ReferralRewardRow["status"]);
  if (filters?.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("created_at", filters.dateTo);

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const referrals = ((data as unknown[]) ?? []).map((r: unknown) => {
    const row = r as Record<string, unknown>;
    const referrer = (row.referrer as Record<string, unknown>) ?? {};
    const referred = (row.referred as Record<string, unknown>) ?? {};
    return {
      id: row.id as string,
      referrerId: row.referrer_id as string,
      referrerName: (referrer.full_name as string) ?? "Unknown",
      referredMemberId: row.referred_member_id as string,
      referredName: (referred.full_name as string) ?? "Unknown",
      rewardType: row.reward_type as string,
      rewardValue: row.reward_value as number,
      status: row.status as string,
      earnedAt: row.earned_at as string | null,
      paidAt: row.paid_at as string | null,
      expiryDate: row.expiry_date as string | null,
      membershipId: row.membership_id as string | null,
      notes: row.notes as string | null,
      createdAt: row.created_at as string,
    };
  });

  return { referrals, total: count ?? 0 };
}

// ─── Reward management ─────────────────────────────────────────────────────

export async function markRewardPaid(organizationId: string, rewardId: string): Promise<ReferralRewardRow> {
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "referral_program", actionName: "referral.reward.pay" });
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("referral_rewards")
    .update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", rewardId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateOrgModules(["/organization/members"]);
  return data;
}

export async function markRewardEarned(organizationId: string, rewardId: string, membershipId?: string): Promise<ReferralRewardRow> {
  const supabase = await createSupabaseServerClient();

  const update = {
    status: "earned" as const,
    earned_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(membershipId ? { membership_id: membershipId } : {}),
  };

  const { data, error } = await supabase
    .from("referral_rewards")
    .update(update)
    .eq("id", rewardId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateOrgModules(["/organization/members"]);
  return data;
}

// ─── Referral on join ──────────────────────────────────────────────────────

export async function processReferralOnJoin(
  organizationId: string,
  newMemberId: string,
  referralCode?: string | null
): Promise<void> {
  if (!referralCode) return;

  const supabase = await createSupabaseServerClient();

  // Look up referrer by referral_code
  const { data: referrer } = await supabase
    .from("members")
    .select("id, full_name, referral_code")
    .eq("referral_code", referralCode)
    .maybeSingle();

  if (!referrer) return; // Invalid code → silent ignore

  // Prevent self-referral
  if (referrer.id === newMemberId) return;

  // Check if org has feature enabled
  const { data: config } = await supabase
    .from("referral_program_config")
    .select("id, reward_type, reward_value, min_membership_days, max_rewards_per_referrer, is_active")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!config || !config.is_active) return;

  // Enforce max rewards per referrer
  if (config.max_rewards_per_referrer > 0) {
    const { count } = await supabase
      .from("referral_rewards")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", referrer.id)
      .eq("status", "earned");

    if ((count ?? 0) >= config.max_rewards_per_referrer) return;
  }

  // Set referred_by on new member
  await supabase
    .from("members")
    .update({ referred_by: referrer.id, updated_at: new Date().toISOString() })
    .eq("id", newMemberId);

  // Set expiry date: min_membership_days * 2 from now (reward expires if not earned)
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + (config.min_membership_days * 2));

  // Create pending reward
  const { error } = await supabase
    .from("referral_rewards")
    .insert({
      organization_id: organizationId,
      referrer_id: referrer.id,
      referred_member_id: newMemberId,
      reward_type: config.reward_type,
      reward_value: config.reward_value,
      status: "pending",
      expiry_date: expiryDate.toISOString(),
      notes: `Referral reward for referring ${referrer.full_name}`,
    });

  if (error) {
    // Don't throw; referral tracking is best-effort
    console.error("Referral reward creation failed:", error.message);
  }

  revalidateOrgModules(["/organization/members"]);
}

// ─── Auto-earn referral rewards (called from membership lifecycle) ─────────

export async function autoEarnReferralRewardsForMember(memberId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // Check if member was referred
  const { data: member } = await supabase
    .from("members")
    .select("id, referred_by")
    .eq("id", memberId)
    .single();

  if (!member || !member.referred_by) return;

  // Find pending rewards for this member
  const { data: pendingRewards } = await supabase
    .from("referral_rewards")
    .select("id, organization_id, status, expiry_date")
    .eq("referred_member_id", memberId)
    .eq("status", "pending");

  if (!pendingRewards || pendingRewards.length === 0) return;

  // Get the org config for min_membership_days
  for (const reward of pendingRewards) {
    // Check if expired
    if (reward.expiry_date && new Date(reward.expiry_date) < new Date()) {
      await supabase
        .from("referral_rewards")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", reward.id);
      continue;
    }

    const { data: config } = await supabase
      .from("referral_program_config")
      .select("min_membership_days, is_active")
      .eq("organization_id", reward.organization_id)
      .maybeSingle();

    if (!config || !config.is_active) continue;

    // Check if member has an active membership old enough
    const { data: oldestMembership } = await supabase
      .from("memberships")
      .select("start_date, id")
      .eq("member_id", memberId)
      .eq("status", "active")
      .order("start_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!oldestMembership) continue;

    const membershipAge = Math.floor(
      (Date.now() - new Date(oldestMembership.start_date).getTime()) / (86400000)
    );

    if (membershipAge >= config.min_membership_days) {
      await markRewardEarned(reward.organization_id, reward.id, oldestMembership.id);
    }
  }
}
