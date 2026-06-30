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
      const q = supabase.from("branch_users").select("id, user_id, role_name, branch_id, status, updated_at, profiles!inner(full_name, email)", { count: "exact" }).eq("organization_id", orgId).in("role_name", ["gym_admin", "reception_staff", "trainer"]);
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

      const targetGymIds = params.gymId && params.gymId !== "all" ? [params.gymId] : gymIds;

      // Fetch primary gym trainers
      const primaryQuery = supabase.from("trainers").select("*", { count: "exact" }).in("gym_id", targetGymIds).not("gym_id", "is", null);

      // Also fetch trainers shared via junction table
      const { data: sharedRows } = await supabase
        .from("trainer_gym_assignments")
        .select("trainer_id")
        .eq("organization_id", orgId)
        .in("gym_id", targetGymIds);

      const sharedIds = [...new Set((sharedRows ?? []).map((r) => r.trainer_id).filter(Boolean))];
      const sharedQuery = sharedIds.length > 0
        ? supabase.from("trainers").select("*", { count: "exact" }).in("id", sharedIds)
        : null;

      const [primaryResult, sharedResult] = await Promise.all([
        primaryQuery.order("created_at", { ascending: false }),
        sharedQuery ? sharedQuery.order("created_at", { ascending: false }) : Promise.resolve({ data: [], count: 0, error: null }),
      ]);

      // Merge and deduplicate
      const seen = new Set<string>();
      const allTrainers: Record<string, unknown>[] = [];
      for (const t of [...(primaryResult.data ?? []), ...((sharedResult.data ?? []) as Record<string, unknown>[])]) {
        const id = t.id as string;
        if (!seen.has(id)) {
          seen.add(id);
          allTrainers.push(t);
        }
      }

      // Apply client-side filtering
      let filtered = allTrainers;
      if (params.status && params.status !== "all") {
        filtered = filtered.filter((t) => t.status === params.status);
      }
      if (params.q) {
        const qLower = params.q.toLowerCase();
        filtered = filtered.filter((t) =>
          (String(t.display_name ?? "").toLowerCase().includes(qLower)) ||
          (String(t.employee_code ?? "").toLowerCase().includes(qLower))
        );
      }

      // Sort by created_at desc
      filtered.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));

      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const paged = filtered.slice(start, start + pageSize);

      return { moduleData: { items: paged }, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } as never;
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
      if (gymIds.length === 0) return { moduleData: { items: [], crossBranchCounts: {} }, total: 0, page, pageSize, totalPages: 0 } as never;
      const q = supabase.from("class_sessions").select("*", { count: "exact" }).in("gym_id", gymIds).not("gym_id", "is", null);
      if (params.status && params.status !== "all") q.eq("status", params.status as never);
      const { data, count } = await q.order("session_date", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      const sessions = data ?? [];
      const sessionIds = sessions.map((s) => s.id);

      let crossBranchCounts: Record<string, number> = {};
      if (sessionIds.length > 0) {
        const { data: bookings } = await supabase
          .from("class_bookings")
          .select("session_id, member_id, gym_id")
          .in("session_id", sessionIds)
          .in("status", ["booked", "checked_in", "attended"]);
        const bookingRows = bookings ?? [];
        if (bookingRows.length > 0) {
          const memberIds = [...new Set(bookingRows.map((b) => b.member_id).filter(Boolean))];
          const { data: members } = await supabase
            .from("members")
            .select("id, gym_id")
            .in("id", memberIds);
          const memberGymMap = new Map<string, string>();
          for (const m of (members ?? [])) {
            if (m.gym_id) {
              memberGymMap.set(m.id, m.gym_id);
            }
          }
          const counts = new Map<string, number>();
          for (const b of bookingRows) {
            if (b.member_id && memberGymMap.get(b.member_id) && memberGymMap.get(b.member_id) !== b.gym_id) {
              counts.set(b.session_id, (counts.get(b.session_id) ?? 0) + 1);
            }
          }
          crossBranchCounts = Object.fromEntries(counts);
        }
      }

      return { moduleData: { items: sessions, crossBranchCounts }, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) } as never;
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

    case "equipment": {
      const { getEquipment } = await import("../actions/equipment-actions");
      const { equipment, total: eqTotal } = await getEquipment(orgId, {
        page,
        pageSize,
      });
      return { moduleData: { items: equipment }, total: eqTotal, page, pageSize, totalPages: Math.ceil(eqTotal / pageSize) } as never;
    }

    case "custom-roles": {
      const { getCustomRoles } = await import("../actions/custom-roles-actions");
      const roles = await getCustomRoles(orgId);
      return { moduleData: { items: roles }, total: roles.length, page: 1, pageSize: roles.length, totalPages: 1 } as never;
    }

    default:
      return { moduleData: { items: [] }, total: 0, page, pageSize, totalPages: 0 } as never;
  }
}
