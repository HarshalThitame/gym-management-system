"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgOwnerContext } from "./action-utils";
import { requireOrganizationFeatureAccess, hasFeatureAccess, entitlementActionCatch } from "@/features/entitlement";
import type { AuthActionState } from "@/features/auth/actions/action-state";

export type CalendarGym = {
  id: string;
  name: string;
  color: string;
};

export type CalendarSession = {
  id: string;
  gym_id: string;
  class_name: string;
  trainer_name: string | null;
  session_date: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  waitlist_count: number;
  status: string;
};

export type NetworkCalendarData = {
  gyms: CalendarGym[];
  sessions: CalendarSession[];
};

const GYM_PALETTE = [
  "#2563eb", "#16a34a", "#9333ea", "#ea580c", "#db2777", "#0891b2",
  "#ca8a04", "#dc2626", "#7c3aed", "#059669", "#0ea5e9", "#d97706",
] as const;

function assignGymColors(gyms: { id: string; name: string }[]): CalendarGym[] {
  return gyms.map((gym, idx) => ({
    ...gym,
    color: GYM_PALETTE[idx % GYM_PALETTE.length] ?? GYM_PALETTE[0],
  }));
}

function getClassNameFromJoin(classes: unknown): string {
  if (!classes) return "";
  if (Array.isArray(classes) && classes.length > 0) {
    const first = classes[0] as Record<string, unknown> | undefined;
    return String(first?.name ?? "");
  }
  const obj = classes as Record<string, unknown>;
  return String(obj.name ?? "");
}

export async function getNetworkCalendar(
  organizationId: string,
  year: number,
  month: number
): Promise<NetworkCalendarData> {
  const hasAccess = await hasFeatureAccess(organizationId, "network_wide_class_calendar");
  if (!hasAccess) {
    throw new Error("Network calendar is not available on your current plan.");
  }

  const supabase = await createSupabaseServerClient();

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name");

  const allGyms = (gyms ?? []).filter((g) => g.id != null);
  const gymIds = allGyms.map((g) => g.id);

  if (gymIds.length === 0) {
    return { gyms: assignGymColors(allGyms), sessions: [] };
  }

  const monthStr = String(month).padStart(2, "0");
  const monthStart = `${year}-${monthStr}-01`;
  const nextMonth = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("id, gym_id, class_id, primary_trainer_id, session_date, starts_at, ends_at, capacity, booked_count, waitlist_count, status, classes!inner(name)")
    .in("gym_id", gymIds)
    .gte("session_date", monthStart)
    .lt("session_date", nextMonth)
    .in("status", ["scheduled", "in_progress", "completed"])
    .order("session_date")
    .order("starts_at");

  const sessionRows = (sessions ?? []).filter((s) => s.gym_id != null);
  const trainerIds = [...new Set(sessionRows.map((s) => s.primary_trainer_id).filter(Boolean))] as string[];

  const trainerNameMap = new Map<string, string>();
  if (trainerIds.length > 0) {
    const { data: trainers } = await supabase
      .from("trainers")
      .select("id, display_name")
      .in("id", trainerIds);
    for (const t of (trainers ?? [])) {
      trainerNameMap.set(t.id, t.display_name);
    }
  }

  const calendarSessions: CalendarSession[] = sessionRows.map((s) => ({
    id: s.id,
    gym_id: s.gym_id!,
    class_name: getClassNameFromJoin((s as Record<string, unknown>).classes),
    trainer_name: s.primary_trainer_id ? (trainerNameMap.get(s.primary_trainer_id) ?? null) : null,
    session_date: s.session_date,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    capacity: s.capacity,
    booked_count: s.booked_count,
    waitlist_count: s.waitlist_count,
    status: s.status,
  }));

  return {
    gyms: assignGymColors(allGyms),
    sessions: calendarSessions,
  };
}

export async function getNetworkCalendarAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState & { data?: NetworkCalendarData }> {
  try {
    const ctx = await getOrgOwnerContext("/organization/classes");
    await requireOrganizationFeatureAccess({
      organizationId: ctx.organizationId,
      featureKey: "network_wide_class_calendar",
      actionName: "calendar.view_network",
    });

    const year = parseInt(formData.get("year") as string, 10);
    const month = parseInt(formData.get("month") as string, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return { ..._prevState, status: "error", message: "Invalid year or month." };
    }

    const data = await getNetworkCalendar(ctx.organizationId, year, month);
    return { ..._prevState, status: "success", message: undefined as unknown as string, data };
  } catch (e) {
    return entitlementActionCatch(_prevState, e, "Failed to load network calendar.");
  }
}
