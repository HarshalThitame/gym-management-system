import { apiClient } from "@/api/client";
import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";
import type {
  Member,
  MemberDashboard,
  AuthProfile,
  FitnessProgress,
  WorkoutProgram,
  NutritionPlan,
} from "@/types";

export const memberService = {
  async getDashboard(memberId: string): Promise<MemberDashboard | null> {
    const cacheKey = offlineCache.memberKey(memberId, "dashboard");
    const cached = await offlineCache.get<MemberDashboard>(cacheKey);

    const { data, ok } = await apiClient.get<MemberDashboard>(
      `/members/${memberId}/dashboard`
    );

    if (ok && data) {
      await offlineCache.set(cacheKey, data, { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true });
      return data;
    }

    if (cached && !cached.stale) return cached.data;
    if (cached) return cached.data;
    return null;
  },

  async getProfile(userId: string): Promise<AuthProfile | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("profiles")
      .select("id,gym_id,full_name,email,phone,avatar_url,status,emergency_contact_name,emergency_contact_phone")
      .eq("id", userId)
      .maybeSingle();

    if (!data) return null;
    return {
      id: data.id,
      gym_id: data.gym_id,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      avatar_url: data.avatar_url,
      status: data.status,
      emergency_contact_name: data.emergency_contact_name,
      emergency_contact_phone: data.emergency_contact_phone,
    };
  },

  async updateProfile(userId: string, updates: Partial<AuthProfile>): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: updates.full_name,
        phone: updates.phone,
        avatar_url: updates.avatar_url,
        emergency_contact_name: updates.emergency_contact_name,
        emergency_contact_phone: updates.emergency_contact_phone,
      })
      .eq("id", userId);

    if (error) return false;

    const cacheKey = offlineCache.memberKey(userId, "profile");
    await offlineCache.evict(cacheKey);
    return true;
  },

  async updateAvatar(userId: string, avatarUrl: string): Promise<boolean> {
    return this.updateProfile(userId, { avatar_url: avatarUrl });
  },

  async getFitnessGoals(memberId: string) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("fitness_goals")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(5);

    return data ?? [];
  },

  async saveFitnessGoal(memberId: string, goal: { title: string; description?: string; target_date?: string }) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("fitness_goals").insert({
      member_id: memberId,
      title: goal.title,
      description: goal.description ?? null,
      target_date: goal.target_date ?? null,
      status: "active",
    });
    return !error;
  },
};
