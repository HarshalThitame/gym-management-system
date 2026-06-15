import { getSupabaseClient } from "@/api/supabase";

const memberIdCache = new Map<string, { id: string; gymId: string; orgId: string } | null>();

export async function getMemberContext(userId: string): Promise<{ id: string; gymId: string; orgId: string } | null> {
  if (memberIdCache.has(userId)) {
    return memberIdCache.get(userId) ?? null;
  }

  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("members")
      .select("id, gym_id, organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return null;

    const context = {
      id: data.id,
      gymId: data.gym_id ?? "",
      orgId: data.organization_id ?? "",
    };
    memberIdCache.set(userId, context);
    setTimeout(() => memberIdCache.delete(userId), 5 * 60 * 1000);
    return context;
  } catch {
    return null;
  }
}

export async function getMemberId(userId: string): Promise<string | null> {
  const ctx = await getMemberContext(userId);
  return ctx?.id ?? null;
}

export async function getMemberGymId(userId: string): Promise<string | null> {
  const ctx = await getMemberContext(userId);
  return ctx?.gymId ?? null;
}

export function clearMemberIdCache(userId?: string): void {
  if (userId) {
    memberIdCache.delete(userId);
  } else {
    memberIdCache.clear();
  }
}
