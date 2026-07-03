import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MemberReferralData = {
  referralCode: string | null;
  referralLink: string;
  totalReferrals: number;
  earnedRewards: number;
  rewards: {
    id: string;
    reward_type: string;
    reward_value: number;
    status: string;
    earned_at: string | null;
    paid_at: string | null;
    expiry_date: string | null;
    referredMemberName: string;
  }[];
  config: {
    reward_type: string;
    reward_value: number;
    is_active: boolean;
  } | null;
};

export async function getMemberReferralData(
  memberId: string,
  organizationId: string
): Promise<MemberReferralData | null> {
  const supabase = await createSupabaseServerClient();

  const { data: member } = await supabase
    .from("members")
    .select("referral_code, full_name")
    .eq("id", memberId)
    .maybeSingle();

  if (!member?.referral_code) return null;

  const [{ data: rewards }, { data: config }] = await Promise.all([
    supabase
      .from("referral_rewards")
      .select("id, reward_type, reward_value, status, earned_at, paid_at, expiry_date, referred_member_id")
      .eq("referrer_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("referral_program_config")
      .select("reward_type, reward_value, is_active")
      .eq("organization_id", organizationId)
      .maybeSingle()
  ]);

  const referredMemberIds = (rewards ?? []).map((r) => r.referred_member_id).filter(Boolean);
  const { data: referredMembers } = referredMemberIds.length > 0
    ? await supabase.from("members").select("id, full_name").in("id", referredMemberIds)
    : { data: [] };
  const memberNameMap = new Map((referredMembers ?? []).map((m) => [m.id, m.full_name]));

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "https://apexperformance.club";
  const referralLink = `${baseUrl}/register?ref=${member.referral_code}`;

  return {
    referralCode: member.referral_code,
    referralLink,
    totalReferrals: (rewards ?? []).filter((r) => r.status !== "expired").length,
    earnedRewards: (rewards ?? []).filter((r) => r.status === "earned").length,
    rewards: (rewards ?? []).map((r) => ({
      id: r.id,
      reward_type: r.reward_type,
      reward_value: r.reward_value,
      status: r.status,
      earned_at: r.earned_at,
      paid_at: r.paid_at,
      expiry_date: r.expiry_date,
      referredMemberName: memberNameMap.get(r.referred_member_id) ?? "New Member"
    })),
    config: config as MemberReferralData["config"]
  };
}
