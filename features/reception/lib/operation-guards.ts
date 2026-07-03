"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ReceptionScope } from "./access";

type ScopedOrganizationId = Pick<ReceptionScope, "gymId" | "branchId" | "scopedOrganizationId" | "organizationId">;

type ScopedEntity = {
  id: string;
  gym_id: string | null;
  branch_id: string | null;
  organization_id: string | null;
};

type PaymentDuplicateCandidate = {
  amount: number;
  method: string | null;
  paymentType: string | null;
  memberId: string;
  membershipId: string | null;
  createdAt: string;
  createdBy: string | null;
};

type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
type TaskStatus = "pending" | "in_progress" | "completed";
type LeadStatus = "new" | "contacted" | "visit_scheduled" | "trial_active" | "converted" | "not_interested" | "lost";

const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["scheduled", "confirmed", "completed", "cancelled", "no_show"],
  confirmed: ["confirmed", "completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress", "completed"],
  in_progress: ["completed"],
  completed: [],
};

const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "visit_scheduled", "trial_active", "not_interested", "lost"],
  contacted: ["visit_scheduled", "trial_active", "not_interested", "lost"],
  visit_scheduled: ["trial_active", "not_interested", "lost"],
  trial_active: ["not_interested", "lost"],
  converted: [],
  not_interested: [],
  lost: [],
};

function scopeOrganizationId(scope: ScopedOrganizationId) {
  return scope.scopedOrganizationId ?? scope.organizationId ?? null;
}

export function applyReceptionScopeFilters<TQuery extends { eq: (column: string, value: unknown) => TQuery }>(
  query: TQuery,
  scope: ScopedOrganizationId,
) {
  let scopedQuery = query.eq("gym_id", scope.gymId);
  if (scope.branchId) {
    scopedQuery = scopedQuery.eq("branch_id", scope.branchId);
  }
  const organizationId = scopeOrganizationId(scope);
  if (organizationId) {
    scopedQuery = scopedQuery.eq("organization_id", organizationId);
  }
  return scopedQuery;
}

export function isRecordInReceptionScope(record: ScopedEntity, scope: ScopedOrganizationId) {
  if (record.gym_id !== scope.gymId) {
    return false;
  }
  if (scope.branchId && record.branch_id !== scope.branchId) {
    return false;
  }
  const organizationId = scopeOrganizationId(scope);
  if (organizationId && record.organization_id !== organizationId) {
    return false;
  }
  return true;
}

export function toOperationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function requireScopedRecord<TRecord extends ScopedEntity>(
  supabase: SupabaseClient<Database>,
  table: keyof Database["public"]["Tables"],
  id: string,
  scope: ReceptionScope,
  notFoundMessage: string,
) {
  const query = applyReceptionScopeFilters(
    supabase.from(table).select("*").eq("id", id),
    scope,
  );
  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(notFoundMessage);
  }

  return data as TRecord;
}

export async function requireScopedMember(supabase: SupabaseClient<Database>, memberId: string, scope: ReceptionScope) {
  return requireScopedRecord<Database["public"]["Tables"]["members"]["Row"]>(supabase, "members", memberId, scope, "Member not found in your assigned branch.");
}

export async function requireScopedTrainer(supabase: SupabaseClient<Database>, trainerId: string, scope: ReceptionScope) {
  return requireScopedRecord<Database["public"]["Tables"]["trainers"]["Row"]>(supabase, "trainers", trainerId, scope, "Trainer not found in your assigned branch.");
}

export async function requireScopedLead(supabase: SupabaseClient<Database>, leadId: string, scope: ReceptionScope) {
  return requireScopedRecord<Database["public"]["Tables"]["leads"]["Row"]>(supabase, "leads", leadId, scope, "Lead not found in your assigned branch.");
}

export async function requireScopedTask(supabase: SupabaseClient<Database>, taskId: string, scope: ReceptionScope) {
  return requireScopedRecord<Database["public"]["Tables"]["tasks"]["Row"]>(supabase, "tasks", taskId, scope, "Task not found in your assigned branch.");
}

export async function requireScopedAppointment(supabase: SupabaseClient<Database>, appointmentId: string, scope: ReceptionScope) {
  return requireScopedRecord<Database["public"]["Tables"]["appointments"]["Row"]>(supabase, "appointments", appointmentId, scope, "Appointment not found in your assigned branch.");
}

export async function requireScopedDocument(supabase: SupabaseClient<Database>, documentId: string, scope: ReceptionScope) {
  return requireScopedRecord<Database["public"]["Tables"]["member_documents"]["Row"]>(supabase, "member_documents", documentId, scope, "Document not found in your assigned branch.");
}

export async function requireScopedMembership(supabase: SupabaseClient<Database>, membershipId: string, scope: ReceptionScope) {
  return requireScopedRecord<Database["public"]["Tables"]["memberships"]["Row"]>(supabase, "memberships", membershipId, scope, "Membership not found in your assigned branch.");
}

export async function requireScopedMembershipPlan(supabase: SupabaseClient<Database>, planId: string, scope: ReceptionScope) {
  return requireScopedRecord<Database["public"]["Tables"]["membership_plans"]["Row"]>(supabase, "membership_plans", planId, scope, "Membership plan not found in your assigned branch.");
}

export function buildOperationalReference(prefix: string, now = new Date(), randomToken = crypto.randomUUID().slice(0, 6)) {
  const compactTimestamp = now.toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 14);
  return `${prefix}-${compactTimestamp}-${randomToken.toUpperCase()}`;
}

export function assertAppointmentTransition(currentStatus: AppointmentStatus, nextStatus: AppointmentStatus) {
  if (!APPOINTMENT_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new Error(`Appointments in ${currentStatus.replaceAll("_", " ")} status cannot move to ${nextStatus.replaceAll("_", " ")}.`);
  }
}

export function assertTaskTransition(currentStatus: TaskStatus, nextStatus: TaskStatus) {
  if (!TASK_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new Error(`Tasks in ${currentStatus.replaceAll("_", " ")} status cannot move to ${nextStatus.replaceAll("_", " ")}.`);
  }
}

export function assertLeadTransition(currentStatus: LeadStatus, nextStatus: LeadStatus) {
  if (nextStatus === "converted") {
    throw new Error("Use the lead conversion workflow to mark a lead as converted.");
  }
  if (!LEAD_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new Error(`Leads in ${currentStatus.replaceAll("_", " ")} status cannot move to ${nextStatus.replaceAll("_", " ")}.`);
  }
}

export function isLikelyDuplicatePayment(
  existing: PaymentDuplicateCandidate,
  next: Omit<PaymentDuplicateCandidate, "createdAt">,
  duplicateWindowMs = 2 * 60 * 1000,
) {
  const createdAt = new Date(existing.createdAt).getTime();
  if (Number.isNaN(createdAt)) {
    return false;
  }
  return (
    Date.now() - createdAt <= duplicateWindowMs &&
    existing.amount === next.amount &&
    existing.method === next.method &&
    existing.paymentType === next.paymentType &&
    existing.memberId === next.memberId &&
    (existing.membershipId ?? null) === (next.membershipId ?? null) &&
    (existing.createdBy ?? null) === (next.createdBy ?? null)
  );
}

export async function findRecentDuplicatePayment(
  supabase: SupabaseClient<Database>,
  scope: ReceptionScope,
  input: Omit<PaymentDuplicateCandidate, "createdAt">,
) {
  const query = applyReceptionScopeFilters(
    supabase
      .from("payments")
      .select("id, amount, method, payment_type, member_id, membership_id, created_at, created_by, payment_number, receipt_number")
      .eq("member_id", input.memberId)
      .eq("amount", input.amount)
      .eq("method", input.method ?? "")
      .eq("payment_type", input.paymentType ?? "")
      .order("created_at", { ascending: false })
      .limit(5),
    scope,
  );

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).find((payment) => isLikelyDuplicatePayment({
    amount: payment.amount,
    method: payment.method,
    paymentType: payment.payment_type,
    memberId: payment.member_id ?? "",
    membershipId: payment.membership_id,
    createdAt: payment.created_at ?? "",
    createdBy: payment.created_by,
  }, input)) ?? null;
}

export async function assertNoAppointmentConflicts(input: {
  supabase: SupabaseClient<Database>;
  scope: ReceptionScope;
  appointmentId?: string | null;
  memberId: string;
  trainerId?: string | null;
  startsAt: string;
  endsAt: string;
}) {
  const memberQuery = applyReceptionScopeFilters(
    input.supabase
      .from("appointments")
      .select("id")
      .eq("member_id", input.memberId)
      .in("status", ["scheduled", "confirmed"])
      .lt("starts_at", input.endsAt)
      .gt("ends_at", input.startsAt),
    input.scope,
  );
  const trainerQuery = input.trainerId
    ? applyReceptionScopeFilters(
        input.supabase
          .from("appointments")
          .select("id")
          .eq("trainer_id", input.trainerId)
          .in("status", ["scheduled", "confirmed"])
          .lt("starts_at", input.endsAt)
          .gt("ends_at", input.startsAt),
        input.scope,
      )
    : null;

  const [memberResult, trainerResult] = await Promise.all([
    memberQuery,
    trainerQuery,
  ]);

  if (memberResult.error) {
    throw new Error(memberResult.error.message);
  }

  if (trainerResult?.error) {
    throw new Error(trainerResult.error.message);
  }

  const conflictingMemberAppointment = (memberResult.data ?? []).find((row) => row.id !== input.appointmentId);
  if (conflictingMemberAppointment) {
    throw new Error("The selected member already has an overlapping appointment.");
  }

  const conflictingTrainerAppointment = (trainerResult?.data ?? []).find((row) => row.id !== input.appointmentId);
  if (conflictingTrainerAppointment) {
    throw new Error("The selected trainer already has an overlapping appointment.");
  }
}
