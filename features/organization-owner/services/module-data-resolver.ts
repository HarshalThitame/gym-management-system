import type { ScopedOrganizationOwnerContext } from "./organization-owner-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ModuleSearchParams = {
  q?: string | undefined;
  status?: string | undefined;
  source?: string | undefined;
  role?: string | undefined;
  gymId?: string | undefined;
  sort?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
};

export type ModuleDataResult<T> = {
  data: T;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function resolveModuleData(
  slug: string,
  ctx: ScopedOrganizationOwnerContext,
  params: ModuleSearchParams
): Promise<{ moduleData: unknown; filters: ModuleSearchParams }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, params.pageSize ?? 12));
  const supabase = await createSupabaseServerClient();
  const orgId = ctx.organizationId;

  const gymIdsQuery = () => supabase.from("gyms").select("id").eq("organization_id", orgId);
  const getGymIds = async () => (await gymIdsQuery()).data?.map((g) => g.id) ?? [];

  switch (slug) {
    case "gyms":
    case "branches": {
      const q = supabase.from("gyms").select("*", { count: "exact" }).eq("organization_id", orgId);
      if (params.status && params.status !== "all") q.eq("status", params.status as never);
      if (params.q) q.or(`name.ilike.%${params.q}%,slug.ilike.%${params.q}%`);
      const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize), filters: params } as never;
    }

    case "staff": {
      const q = supabase.from("branch_users").select("id, user_id, role_name, branch_id, status, updated_at, profiles!inner(full_name, email)", { count: "exact" }).eq("organization_id", orgId);
      if (params.role && params.role !== "all") q.eq("role_name", params.role as never);
      if (params.status && params.status !== "all") q.eq("status", params.status as never);
      const { data, count } = await q.order("updated_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) } as never;
    }

    case "members": {
      const gymIds = await getGymIds();
      if (gymIds.length === 0) return { moduleData: { items: [] }, total: 0, page, pageSize, totalPages: 0 } as never;
      const targetGymIds = params.gymId && params.gymId !== "all" ? [params.gymId] : gymIds;
      const q = supabase.from("members").select("*", { count: "exact" }).in("gym_id", targetGymIds);
      if (params.status && params.status !== "all") q.eq("status", params.status as never);
      if (params.q) q.or(`full_name.ilike.%${params.q}%,phone.ilike.%${params.q}%,email.ilike.%${params.q}%`);
      const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) } as never;
    }

    case "revenue": {
      const gymIds = await getGymIds();
      if (gymIds.length === 0) return { moduleData: { items: [] }, total: 0, page, pageSize, totalPages: 0 } as never;
      const targetGymIds = params.gymId && params.gymId !== "all" ? [params.gymId] : gymIds;
      const q = supabase.from("payments").select("*", { count: "exact" }).in("gym_id", targetGymIds).not("gym_id", "is", null);
      if (params.status && params.status !== "all") q.eq("status", params.status as never);
      if (params.dateFrom) q.gte("created_at", params.dateFrom);
      if (params.dateTo) q.lte("created_at", params.dateTo);
      const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) } as never;
    }

    case "trainers": {
      const gymIds = await getGymIds();
      if (gymIds.length === 0) return { moduleData: { items: [] }, total: 0, page, pageSize, totalPages: 0 } as never;
      const q = supabase.from("trainers").select("*", { count: "exact" }).in("gym_id", gymIds).not("gym_id", "is", null);
      if (params.status && params.status !== "all") q.eq("status", params.status as never);
      if (params.q) q.or(`display_name.ilike.%${params.q}%,employee_code.ilike.%${params.q}%`);
      const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) } as never;
    }

    case "memberships": {
      const gymIds = await getGymIds();
      if (gymIds.length === 0) return { moduleData: { items: [] }, total: 0, page, pageSize, totalPages: 0 } as never;
      const q = supabase.from("membership_plans").select("*", { count: "exact" }).in("gym_id", gymIds).not("gym_id", "is", null);
      if (params.status && params.status !== "all") q.eq("status", params.status as never);
      const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) } as never;
    }

    case "attendance": {
      const gymIds = await getGymIds();
      if (gymIds.length === 0) return { moduleData: { items: [] }, total: 0, page, pageSize, totalPages: 0 } as never;
      const q = supabase.from("attendance_logs").select("*", { count: "exact" }).in("gym_id", gymIds).not("gym_id", "is", null);
      if (params.status && params.status !== "all") q.eq("result", params.status as never);
      if (params.q) q.or(`action.ilike.%${params.q}%,message.ilike.%${params.q}%`);
      const { data, count } = await q.order("occurred_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) } as never;
    }

    case "classes": {
      const gymIds = await getGymIds();
      if (gymIds.length === 0) return { moduleData: { items: [] }, total: 0, page, pageSize, totalPages: 0 } as never;
      const q = supabase.from("class_sessions").select("*", { count: "exact" }).in("gym_id", gymIds).not("gym_id", "is", null);
      if (params.status && params.status !== "all") q.eq("status", params.status as never);
      const { data, count } = await q.order("session_date", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) } as never;
    }

    case "analytics": {
      const { data } = await supabase.from("branch_metrics").select("*").eq("organization_id", orgId).order("metric_date", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: data?.length ?? 0, page, pageSize, totalPages: Math.ceil((data?.length ?? 0) / pageSize) } as never;
    }

    case "branding": {
      const q = supabase.from("tenant_configs").select("*", { count: "exact" }).eq("organization_id", orgId);
      const { data, count } = await q.order("updated_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) } as never;
    }

    case "domains": {
      const q = supabase.from("tenant_domains").select("*", { count: "exact" }).eq("organization_id", orgId);
      const { data, count } = await q.order("is_primary", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) } as never;
    }

    case "billing": {
      const q = supabase.from("platform_subscriptions").select("*", { count: "exact" }).eq("organization_id", orgId);
      const { data, count } = await q.order("updated_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) } as never;
    }

    case "settings": {
      const { data } = await supabase.from("feature_flags").select("*").eq("organization_id", orgId).order("updated_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      return { moduleData: { items: data ?? [] }, total: data?.length ?? 0, page, pageSize, totalPages: Math.ceil((data?.length ?? 0) / pageSize) } as never;
    }

    case "security": {
      const [eventsResult, activityResult] = await Promise.all([
        supabase.from("security_events").select("*", { count: "exact" }).eq("organization_id", orgId).order("created_at", { ascending: false }).range(0, 49),
        supabase.from("activity_events").select("*", { count: "exact" }).eq("organization_id", orgId).order("created_at", { ascending: false }).range(0, 49)
      ]);
      return { moduleData: { securityEvents: eventsResult.data ?? [], activityEvents: activityResult.data ?? [] }, total: (eventsResult.count ?? 0) + (activityResult.count ?? 0), page, pageSize, totalPages: 1 } as never;
    }

    case "leads": {
      const { getLeads } = await import("../services/lead-service");
      const result = await getLeads(orgId, {
        q: params.q ?? undefined,
        status: params.status ?? undefined,
        source: params.source ?? undefined,
        page,
        pageSize,
      });
      return { moduleData: { items: result.leads }, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages } as never;
    }

    default:
      return { moduleData: { items: [] }, total: 0, page, pageSize, totalPages: 0 } as never;
  }
}
