"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { requireReceptionScope } from "@/features/reception/lib/access";
import {
  assertAppointmentTransition,
  assertNoAppointmentConflicts,
  requireScopedAppointment,
  requireScopedMember,
  requireScopedTrainer,
  toOperationErrorMessage,
} from "@/features/reception/lib/operation-guards";
import { AppointmentSchema, CancelAppointmentSchema, CompleteAppointmentSchema } from "../schemas/appointments";

function validationState(fieldErrors: Record<string, string[]>): AuthActionState {
  return { status: "error", message: "Validation failed.", fieldErrors };
}

function successState(message: string): AuthActionState {
  return { status: "success", message, success: true };
}

function errorState(message: string): AuthActionState {
  return { status: "error", message, success: false };
}

export async function saveAppointmentAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/appointments");

  const parsed = AppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId") ?? "",
    memberId: formData.get("memberId") ?? "",
    trainerId: formData.get("trainerId") ?? "",
    title: formData.get("title") ?? "",
    type: formData.get("type") ?? "general",
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? "",
    location: formData.get("location") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const isUpdate = !!parsed.data.appointmentId;
  let member;
  let trainer = null;
  let currentAppointment = null;
  try {
    member = await requireScopedMember(supabase, parsed.data.memberId, scope);
    trainer = parsed.data.trainerId ? await requireScopedTrainer(supabase, parsed.data.trainerId, scope) : null;
    currentAppointment = isUpdate
      ? await requireScopedAppointment(supabase, parsed.data.appointmentId, scope)
      : null;

    if (currentAppointment) {
      assertAppointmentTransition(currentAppointment.status, currentAppointment.status);
    }

    await assertNoAppointmentConflicts({
      supabase,
      scope,
      appointmentId: currentAppointment?.id ?? null,
      memberId: member.id,
      trainerId: trainer?.id ?? null,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
    });
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to validate this appointment."));
  }

  const payload = {
    gym_id: scope.gymId,
    branch_id: scope.branchId,
    organization_id: scope.scopedOrganizationId ?? scope.organizationId,
    member_id: member.id,
    trainer_id: trainer?.id ?? null,
    title: parsed.data.title,
    type: parsed.data.type,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    location: parsed.data.location || null,
    notes: parsed.data.notes || null,
    updated_at: new Date().toISOString()
  };

  const result = isUpdate
    ? await supabase
        .from("appointments")
        .update(payload)
        .eq("id", parsed.data.appointmentId)
        .eq("gym_id", scope.gymId)
        .select("*")
        .maybeSingle()
    : await supabase
        .from("appointments")
        .insert({
          ...payload,
          created_by: scope.userId,
          status: "scheduled"
        })
        .select("*")
        .maybeSingle();

  if (result.error) {
    return errorState(result.error.message);
  }

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: isUpdate ? "appointment.update" : "appointment.create",
    entityType: "appointment",
    entityId: result.data?.id ?? parsed.data.appointmentId ?? "",
    metadata: {
      type: parsed.data.type,
      memberId: member.id,
      trainerId: trainer?.id ?? null,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      gymId: scope.gymId,
    }
  });

  revalidatePath("/reception/appointments");
  return successState(isUpdate ? "Appointment updated." : "Appointment scheduled.");
}

export async function cancelAppointmentAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/appointments");

  const parsed = CancelAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  let appointment;
  try {
    appointment = await requireScopedAppointment(supabase, parsed.data.appointmentId, scope);
    assertAppointmentTransition(appointment.status, "cancelled");
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to cancel this appointment."));
  }
  const { error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      cancel_reason: parsed.data.reason,
      cancelled_by: scope.userId,
      updated_at: new Date().toISOString()
    })
    .eq("id", parsed.data.appointmentId)
    .eq("gym_id", scope.gymId);

  if (error) return errorState(error.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "appointment.cancel",
    entityType: "appointment",
    entityId: parsed.data.appointmentId,
    metadata: {
      reason: parsed.data.reason,
      memberId: appointment.member_id,
      trainerId: appointment.trainer_id,
    }
  });

  revalidatePath("/reception/appointments");
  return successState("Appointment cancelled.");
}

export async function completeAppointmentAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/appointments");

  const parsed = CompleteAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  let appointment;
  try {
    appointment = await requireScopedAppointment(supabase, parsed.data.appointmentId, scope);
    assertAppointmentTransition(appointment.status, "completed");
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to complete this appointment."));
  }

  const updatePayload: Record<string, unknown> = {
    status: "completed",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (parsed.data.notes) {
    updatePayload.notes = parsed.data.notes;
  }

  const { error } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", parsed.data.appointmentId)
    .eq("gym_id", scope.gymId);

  if (error) return errorState(error.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "appointment.complete",
    entityType: "appointment",
    entityId: parsed.data.appointmentId,
    metadata: {
      memberId: appointment.member_id,
      trainerId: appointment.trainer_id,
    }
  });

  revalidatePath("/reception/appointments");
  return successState("Appointment marked as completed.");
}

export async function markNoShowAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/appointments");

  const appointmentId = formData.get("appointmentId") as string;
  if (!appointmentId) {
    return errorState("Appointment ID is required.");
  }

  const supabase = await createSupabaseServerClient();
  let appointment;
  try {
    appointment = await requireScopedAppointment(supabase, appointmentId, scope);
    assertAppointmentTransition(appointment.status, "no_show");
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to mark this appointment as no-show."));
  }
  const { error } = await supabase
    .from("appointments")
    .update({
      status: "no_show",
      updated_at: new Date().toISOString()
    })
    .eq("id", appointmentId)
    .eq("gym_id", scope.gymId);

  if (error) return errorState(error.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "appointment.no_show",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: {
      memberId: appointment.member_id,
      trainerId: appointment.trainer_id,
    }
  });

  revalidatePath("/reception/appointments");
  return successState("Appointment marked as no-show.");
}
