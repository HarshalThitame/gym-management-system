"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export type AttendanceRecord = {
  id: string;
  organization_id: string;
  staff_id: string;
  branch_id: string | null;
  clock_in: string;
  clock_out: string | null;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  staff_name?: string | null;
};

export async function getStaffAttendance(
  organizationId: string,
  filters: { staffId?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }
): Promise<{ records: AttendanceRecord[]; total: number }> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.attendance.read" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = (supabase as any)
    .from("staff_attendance")
    .select("*, profiles:staff_id(full_name)", { count: "exact" })
    .eq("organization_id", ctx.organizationId);

  if (filters.staffId) {
    query = query.eq("staff_id", filters.staffId);
  }
  if (filters.dateFrom) {
    query = query.gte("date", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("date", filters.dateTo);
  }

  query = query.order("clock_in", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  const records = ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const profile = r.profiles as { full_name?: string } | null;
    return {
      id: r.id,
      organization_id: r.organization_id,
      staff_id: r.staff_id,
      branch_id: r.branch_id,
      clock_in: r.clock_in,
      clock_out: r.clock_out,
      date: r.date,
      notes: r.notes,
      created_at: r.created_at,
      updated_at: r.updated_at,
      staff_name: profile?.full_name ?? null,
    } as AttendanceRecord;
  });

  return { records, total: count ?? 0 };
}

export async function getTodayAttendanceStatus(
  organizationId: string
): Promise<{ staffId: string; staffName: string; clockedIn: boolean; recordId: string | null }[]> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.attendance.read" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const today = new Date().toISOString().split("T")[0];

  const { data: todayRecords } = await (supabase as any)
    .from("staff_attendance")
    .select("id, staff_id, clock_out")
    .eq("organization_id", ctx.organizationId)
    .eq("date", today);

  const { data: staffData } = await supabase
    .from("branch_users")
    .select("user_id, profiles:user_id(full_name)")
    .eq("organization_id", ctx.organizationId)
    .eq("status", "active");

  return (staffData ?? []).map((s) => {
    const profile = (s as Record<string, unknown>).profiles as { full_name?: string } | null;
    const record = (todayRecords ?? []).find(
      (r: Record<string, unknown>) => r.staff_id === (s as Record<string, unknown>).user_id && !r.clock_out
    );
    return {
      staffId: (s as Record<string, unknown>).user_id as string,
      staffName: profile?.full_name ?? "Unknown",
      clockedIn: !!record,
      recordId: record ? (record as Record<string, unknown>).id as string : null,
    };
  });
}

export async function clockIn(
  organizationId: string,
  staffId: string,
  branchId?: string,
  notes?: string
): Promise<AttendanceRecord> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.attendance.clock_in" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const today = new Date().toISOString().split("T")[0];
  const { data: existing } = await (supabase as any)
    .from("staff_attendance")
    .select("id, clock_out")
    .eq("organization_id", ctx.organizationId)
    .eq("staff_id", staffId)
    .eq("date", today)
    .maybeSingle();

  if (existing && !(existing as Record<string, unknown>).clock_out) {
    throw new Error("Already clocked in today. Please clock out first.");
  }

  const { data, error } = await (supabase as any)
    .from("staff_attendance")
    .insert({
      organization_id: ctx.organizationId,
      staff_id: staffId,
      branch_id: branchId ?? null,
      clock_in: new Date().toISOString(),
      notes: notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorId: ctx.userId,
    action: "organization_owner.clock_in_staff",
    entityType: "staff_attendance",
    entityId: (data as Record<string, unknown>).id as string,
    metadata: { staffId } as never,
  });

  revalidateOrgModules(["/organization/staff"]);

  return data as AttendanceRecord;
}

export async function clockOut(
  organizationId: string,
  attendanceId: string
): Promise<AttendanceRecord> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.attendance.clock_out" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await (supabase as any)
    .from("staff_attendance")
    .select("*")
    .eq("id", attendanceId)
    .eq("organization_id", ctx.organizationId)
    .single();

  if (!existing) throw new Error("Attendance record not found.");
  if ((existing as Record<string, unknown>).clock_out) throw new Error("Already clocked out.");

  const { data, error } = await (supabase as any)
    .from("staff_attendance")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", attendanceId)
    .eq("organization_id", ctx.organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorId: ctx.userId,
    action: "organization_owner.clock_out_staff",
    entityType: "staff_attendance",
    entityId: attendanceId,
  } as never);

  revalidateOrgModules(["/organization/staff"]);

  return data as AttendanceRecord;
}

export async function getMonthlyAttendanceSummary(
  organizationId: string,
  month: number,
  year: number
): Promise<{
  staffId: string;
  staffName: string;
  presentDays: number;
  absentDays: number;
  avgHours: number;
  totalRecords: number;
}[]> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.attendance.summary" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const { data } = await (supabase as any)
    .from("staff_attendance")
    .select("staff_id, clock_in, clock_out, profiles:staff_id(full_name)")
    .eq("organization_id", ctx.organizationId)
    .gte("date", startDate)
    .lte("date", endDate);

  const grouped = new Map<string, { name: string; records: { clock_in: string; clock_out: string | null }[] }>();

  for (const r of (data ?? [])) {
    const record = r as Record<string, unknown>;
    const profile = record.profiles as { full_name?: string } | null;
    const entry = grouped.get(record.staff_id as string) ?? { name: profile?.full_name ?? "Unknown", records: [] };
    entry.records.push({ clock_in: record.clock_in as string, clock_out: record.clock_out as string | null });
    grouped.set(record.staff_id as string, entry);
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  return Array.from(grouped.entries()).map(([staffId, { name, records }]) => {
    const uniqueDays = new Set(records.map((r) => r.clock_in.split("T")[0])).size;
    const completedRecords = records.filter((r) => r.clock_out);
    const totalHours = completedRecords.reduce((sum, r) => {
      const inTime = new Date(r.clock_in).getTime();
      const outTime = new Date(r.clock_out!).getTime();
      return sum + (outTime - inTime) / (1000 * 60 * 60);
    }, 0);

    return {
      staffId,
      staffName: name,
      presentDays: uniqueDays,
      absentDays: Math.max(0, daysInMonth - uniqueDays),
      avgHours: completedRecords.length > 0 ? Math.round((totalHours / completedRecords.length) * 10) / 10 : 0,
      totalRecords: records.length,
    };
  });
}
