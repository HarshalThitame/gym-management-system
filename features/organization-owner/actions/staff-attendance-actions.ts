"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";
import {
  getStaffAttendance as getAttendance,
  getTodayAttendanceStatus as getTodayStatus,
  getMonthlyAttendanceSummary as getMonthlySummary,
} from "../services/staff-attendance-service";
import type { AttendanceRecord } from "../services/staff-attendance-service";

export type { AttendanceRecord };

export async function getStaffAttendance(
  organizationId: string,
  filters: { staffId?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }
): Promise<{ records: AttendanceRecord[]; total: number }> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.attendance.read" });
  void organizationId;

  return getAttendance(ctx.organizationId, filters);
}

export async function getTodayAttendanceStatus(
  organizationId: string
): Promise<{ staffId: string; staffName: string; clockedIn: boolean; recordId: string | null }[]> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.attendance.read" });
  void organizationId;

  return getTodayStatus(ctx.organizationId);
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

  return getMonthlySummary(ctx.organizationId, month, year);
}
