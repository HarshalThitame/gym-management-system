import { apiClient } from "@/api/client";
import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";
import type { Membership, MembershipPlan, MembershipStatus } from "@/types";

export const membershipService = {
  async getCurrentMembership(memberId: string): Promise<{ membership: Membership | null; plan: MembershipPlan | null }> {
    const cacheKey = offlineCache.memberKey(memberId, "membership");
    const cached = await offlineCache.get<{ membership: Membership | null; plan: MembershipPlan | null }>(cacheKey);

    try {
      const supabase = getSupabaseClient();
      const { data: membership } = await supabase
        .from("memberships")
        .select("*")
        .eq("member_id", memberId)
        .in("status", ["active", "pending", "frozen"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let plan: MembershipPlan | null = null;
      if (membership) {
        const { data: planData } = await supabase
          .from("membership_plans")
          .select("*")
          .eq("id", membership.plan_id)
          .maybeSingle();
        plan = planData;
      }

      const result = { membership, plan };
      await offlineCache.set(cacheKey, result, { ttlMs: 15 * 60 * 1000, staleWhileRevalidate: true });
      return result;
    } catch {
      if (cached) return cached.data;
      return { membership: null, plan: null };
    }
  },

  async getMembershipHistory(memberId: string): Promise<Membership[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("memberships")
      .select("*, membership_plans!inner(name, plan_type)")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });

    return data ?? [];
  },

  async getRemainingDays(endDate: string | null): Promise<number> {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  },

  async canRenew(membership: Membership): Promise<boolean> {
    const daysLeft = await this.getRemainingDays(membership.end_date);
    return daysLeft <= 30 || membership.status === "expired";
  },

  async canUpgrade(membership: Membership): Promise<boolean> {
    const daysLeft = await this.getRemainingDays(membership.end_date);
    return daysLeft >= 15 && membership.status === "active";
  },

  async checkFreezeEligibility(membership: Membership): Promise<{ eligible: boolean; reason?: string }> {
    if (membership.status !== "active") {
      return { eligible: false, reason: "Only active memberships can be frozen." };
    }
    const daysLeft = await this.getRemainingDays(membership.end_date);
    if (daysLeft < 7) {
      return { eligible: false, reason: "Cannot freeze with less than 7 days remaining." };
    }
    return { eligible: true };
  },

  async freezeMembership(membershipId: string, reason: string, durationDays: number): Promise<{ ok: boolean; error?: string }> {
    try {
      const supabase = getSupabaseClient();
      const freezeEnd = new Date();
      freezeEnd.setDate(freezeEnd.getDate() + durationDays);

      const { error } = await supabase
        .from("memberships")
        .update({
          status: "frozen",
          notes: `Frozen: ${reason}. Expected unfreeze: ${freezeEnd.toISOString().split("T")[0]}`,
        })
        .eq("id", membershipId);

      if (error) return { ok: false, error: error.message };

      await supabase.from("membership_history").insert({
        membership_id: membershipId,
        event_type: "frozen",
        event_data: { reason, duration_days: durationDays, frozen_until: freezeEnd.toISOString() },
        created_at: new Date().toISOString(),
      });

      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Freeze failed";
      return { ok: false, error: msg };
    }
  },
};
