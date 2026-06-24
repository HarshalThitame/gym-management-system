"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrgFeatureAccess } from "@/features/entitlement";

export type DashboardLayout = {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  widgets: DashboardWidget[];
  created_at: string;
  updated_at: string;
};

export type DashboardWidget = {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  size?: "sm" | "md" | "lg";
  config?: Record<string, unknown>;
};

export type SaveDashboardLayoutInput = {
  name: string;
  widgets: DashboardWidget[];
  isDefault?: boolean;
};

export async function getDashboardLayouts(organizationId: string): Promise<{
  layouts: DashboardLayout[];
  defaultLayout: DashboardLayout | null;
}> {
  await requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis");

  const supabase = await createSupabaseServerClient();

  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return { layouts: [], defaultLayout: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const [layoutsRes, defaultRes] = await Promise.all([
    db
      .from("dashboard_layouts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    db
      .from("dashboard_layouts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle(),
  ]);

  if (layoutsRes.error) throw new Error(layoutsRes.error.message);
  return {
    layouts: (layoutsRes.data ?? []) as DashboardLayout[],
    defaultLayout: (defaultRes.data ?? null) as DashboardLayout | null,
  };
}

export async function saveDashboardLayout(
  organizationId: string,
  input: SaveDashboardLayoutInput
): Promise<DashboardLayout> {
  const { userId } = await requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis");

  const supabase = await createSupabaseServerClient();

  // If setting as default, unset other defaults first
  if (input.isDefault) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("dashboard_layouts")
      .update({ is_default: false })
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("is_default", true);
  }

  // Upsert by unique (organization_id, user_id, name)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("dashboard_layouts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("name", input.name)
    .maybeSingle();

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("dashboard_layouts")
      .update({
        widgets: input.widgets,
        is_default: input.isDefault ?? false,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/organization");
    return data as DashboardLayout;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("dashboard_layouts")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      name: input.name,
      is_default: input.isDefault ?? false,
      widgets: input.widgets,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/organization");
  return data as DashboardLayout;
}

export async function deleteDashboardLayout(
  organizationId: string,
  layoutId: string
): Promise<void> {
  await requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis");

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("dashboard_layouts")
    .delete()
    .eq("id", layoutId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
  revalidatePath("/organization");
}

export async function getDefaultLayout(organizationId: string): Promise<DashboardLayout | null> {
  await requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis");

  const supabase = await createSupabaseServerClient();
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("dashboard_layouts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as DashboardLayout | null;
}

// ─── KPI data fetchers for new widget types ─────────────────────────────────

export async function getNewLeadsCount(organizationId: string): Promise<number> {
  await requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis");

  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count, error } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthStart);

  if (error) return 0;
  return count ?? 0;
}

export async function getExpiringMembershipsCount(organizationId: string): Promise<number> {
  await requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis");

  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000);

  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("id, end_date, status")
    .eq("status", "active")
    .gte("end_date", now.toISOString().slice(0, 10))
    .lte("end_date", thirtyDaysFromNow.toISOString().slice(0, 10));

  if (error) return 0;

  return memberships?.length ?? 0;
}

export async function getClassOccupancyAvg(organizationId: string): Promise<number> {
  await requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis");

  const supabase = await createSupabaseServerClient();
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = gyms?.map((g) => g.id) ?? [];
  if (gymIds.length === 0) return 0;

  const { data: sessions, error } = await supabase
    .from("class_sessions")
    .select("capacity, booked_count")
    .in("gym_id", gymIds)
    .not("capacity", "is", null)
    .not("booked_count", "is", null)
    .limit(100);

  if (error || !sessions?.length) return 0;

  const total = sessions.reduce((sum, s) => {
    const cap = Number(s.capacity ?? 0);
    const booked = Number(s.booked_count ?? 0);
    if (cap === 0) return sum;
    return sum + (booked / cap) * 100;
  }, 0);

  return Math.round(total / sessions.length);
}

export async function getCheckInsToday(organizationId: string): Promise<number> {
  await requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis");

  const supabase = await createSupabaseServerClient();
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = gyms?.map((g) => g.id) ?? [];
  if (gymIds.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);

  const { count, error } = await supabase
    .from("attendance_logs")
    .select("*", { count: "exact", head: true })
    .in("gym_id", gymIds)
    .gte("occurred_at", today)
    .lt("occurred_at", `${today}T23:59:59`);

  if (error) return 0;
  return count ?? 0;
}
