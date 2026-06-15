import { getSupabaseClient } from "@/api/supabase";

export type LimitType = "members" | "trainers" | "staff" | "branches" | "storage_mb";

export async function checkLimit(organizationId: string, limitType: LimitType): Promise<{ ok: boolean; current: number; limit: number; error?: string }> {
  try {
    const supabase = getSupabaseClient();

    const { data: sub } = await supabase
      .from("platform_subscriptions")
      .select("member_limit, branch_limit, staff_limit, storage_limit_mb")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!sub) return { ok: false, current: 0, limit: 0, error: "No subscription found" };

    let current = 0;
    let limit = 0;

    switch (limitType) {
      case "members": {
        limit = sub.member_limit ?? 100;
        const { count } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
        current = count ?? 0;
        break;
      }
      case "trainers": {
        limit = sub.staff_limit ?? 20;
        const { count } = await supabase.from("trainers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
        current = count ?? 0;
        break;
      }
      case "staff": {
        limit = sub.staff_limit ?? 10;
        const { count } = await supabase.from("branch_users").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).neq("role_name", "member");
        current = count ?? 0;
        break;
      }
      case "branches": {
        limit = sub.branch_limit ?? 1;
        const { count } = await supabase.from("branches").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active");
        current = count ?? 0;
        break;
      }
      case "storage_mb": {
        limit = sub.storage_limit_mb ?? 100;
        const { data: total } = await supabase.rpc("get_org_storage_used", { org_id: organizationId }).maybeSingle();
        current = Math.round(((total as any) ?? 0) / (1024 * 1024));
        break;
      }
    }

    if (current >= limit) {
      return { ok: false, current, limit, error: `${limitType} limit reached (${current}/${limit}). Upgrade your plan to increase this limit.` };
    }

    return { ok: true, current, limit };
  } catch {
    return { ok: false, current: 0, limit: 0, error: "Could not verify limit" };
  }
}
