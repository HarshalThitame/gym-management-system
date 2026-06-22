"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export type LeaveRequest = {
  id: string;
  organization_id: string;
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  approver_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  staff_name?: string | null;
};

export async function getLeaveRequests(
  organizationId: string,
  filters: { staffId?: string; status?: string; page?: number; pageSize?: number }
): Promise<{ requests: LeaveRequest[]; total: number }> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.leave.read" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = (supabase as any)
    .from("staff_leave_requests")
    .select("*, profiles:staff_id(full_name)", { count: "exact" })
    .eq("organization_id", ctx.organizationId);

  if (filters.staffId) {
    query = query.eq("staff_id", filters.staffId);
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  const requests = ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const profile = r.profiles as { full_name?: string } | null;
    return {
      id: r.id,
      organization_id: r.organization_id,
      staff_id: r.staff_id,
      leave_type: r.leave_type,
      start_date: r.start_date,
      end_date: r.end_date,
      reason: r.reason,
      status: r.status,
      approver_id: r.approver_id,
      approved_at: r.approved_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      staff_name: profile?.full_name ?? null,
    } as LeaveRequest;
  });

  return { requests, total: count ?? 0 };
}

export async function createLeaveRequest(
  organizationId: string,
  data: { staffId: string; leaveType: string; startDate: string; endDate: string; reason?: string }
): Promise<LeaveRequest> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.leave.create" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const { data: overlapping } = await (supabase as any)
    .from("staff_leave_requests")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("staff_id", data.staffId)
    .eq("status", "approved")
    .gte("end_date", data.startDate)
    .lte("start_date", data.endDate);

  if (overlapping && overlapping.length > 0) {
    throw new Error("Staff already has an approved leave overlapping this date range.");
  }

  const { data: result, error } = await (supabase as any)
    .from("staff_leave_requests")
    .insert({
      organization_id: ctx.organizationId,
      staff_id: data.staffId,
      leave_type: data.leaveType,
      start_date: data.startDate,
      end_date: data.endDate,
      reason: data.reason ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorId: ctx.userId,
    action: "organization_owner.create_leave_request",
    entityType: "staff_leave_requests",
    entityId: (result as Record<string, unknown>).id as string,
    metadata: { staffId: data.staffId, leaveType: data.leaveType } as never,
  });

  revalidateOrgModules(["/organization/staff"]);

  return result as LeaveRequest;
}

export async function approveLeaveRequest(
  organizationId: string,
  requestId: string
): Promise<LeaveRequest> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.leave.approve" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await (supabase as any)
    .from("staff_leave_requests")
    .update({
      status: "approved",
      approver_id: ctx.userId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("organization_id", ctx.organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorId: ctx.userId,
    action: "organization_owner.approve_leave",
    entityType: "staff_leave_requests",
    entityId: requestId,
  } as never);

  revalidateOrgModules(["/organization/staff"]);

  return data as LeaveRequest;
}

export async function rejectLeaveRequest(
  organizationId: string,
  requestId: string,
  reason?: string
): Promise<LeaveRequest> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.leave.reject" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await (supabase as any)
    .from("staff_leave_requests")
    .update({
      status: "rejected",
      approver_id: ctx.userId,
    })
    .eq("id", requestId)
    .eq("organization_id", ctx.organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorId: ctx.userId,
    action: "organization_owner.reject_leave",
    entityType: "staff_leave_requests",
    entityId: requestId,
    metadata: reason ? { reason } as never : undefined,
  } as never);

  revalidateOrgModules(["/organization/staff"]);

  return data as LeaveRequest;
}

export async function getLeaveStats(
  organizationId: string
): Promise<{ pending: number; approvedThisMonth: number; rejectedThisMonth: number }> {
  const ctx = await getOrgOwnerContext("/organization/staff");
  await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "staff_attendance_leave", actionName: "staff.leave.stats" });
  void organizationId;

  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { count: pending } = await (supabase as any)
    .from("staff_leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .eq("status", "pending");

  const { count: approved } = await (supabase as any)
    .from("staff_leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .eq("status", "approved")
    .gte("created_at", monthStart);

  const { count: rejected } = await (supabase as any)
    .from("staff_leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .eq("status", "rejected")
    .gte("created_at", monthStart);

  return {
    pending: pending ?? 0,
    approvedThisMonth: approved ?? 0,
    rejectedThisMonth: rejected ?? 0,
  };
}
