import { getSupabaseClient } from "@/api/supabase";

export const referralService = {
  async getReferralCode(memberId: string): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("member_referrals")
      .select("referral_code")
      .eq("member_id", memberId)
      .maybeSingle();

    return data?.referral_code ?? null;
  },

  async generateReferralCode(memberId: string): Promise<string | null> {
    const code = this.generateCode();
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("member_referrals").upsert({
      member_id: memberId,
      referral_code: code,
      created_at: new Date().toISOString(),
    });

    if (error) return null;
    return code;
  },

  async getReferralStats(memberId: string) {
    const supabase = getSupabaseClient();
    const { data: referrals } = await supabase
      .from("referral_redemptions")
      .select("status, reward_amount, created_at")
      .eq("referrer_member_id", memberId)
      .order("created_at", { ascending: false });

    const records = referrals ?? [];
    return {
      totalReferrals: records.length,
      successfulReferrals: records.filter((r) => r.status === "completed").length,
      pendingReferrals: records.filter((r) => r.status === "pending").length,
      totalRewards: records
        .filter((r) => r.status === "completed")
        .reduce((sum, r) => sum + (r.reward_amount ?? 0), 0),
      history: records,
    };
  },

  generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  },
};
