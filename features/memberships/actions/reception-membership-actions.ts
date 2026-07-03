"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { requireReceptionScope } from "@/features/reception/lib/access";
import {
  requireScopedMember,
  requireScopedMembership,
  requireScopedMembershipPlan,
  toOperationErrorMessage,
} from "@/features/reception/lib/operation-guards";

function successState(message: string): AuthActionState {
  return { status: "success", message, success: true };
}

function errorState(message: string): AuthActionState {
  return { status: "error", message, success: false };
}

export async function renewMembershipFrontDeskAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/memberships");

  const membershipId = formData.get("membershipId") as string;
  const planId = formData.get("planId") as string;
  const durationDays = Number(formData.get("durationDays") ?? "30");

  if (!membershipId) return errorState("Membership ID is required.");
  if (!planId) return errorState("Please select a plan.");

  const supabase = await createSupabaseServerClient();
  let currentMembership;
  let member;
  let plan;
  try {
    currentMembership = await requireScopedMembership(supabase, membershipId, scope);
    member = await requireScopedMember(supabase, currentMembership.member_id, scope);
    plan = await requireScopedMembershipPlan(supabase, planId, scope);
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to validate this renewal request."));
  }

  if (plan.status !== "active") {
    return errorState("Only active plans can be used for renewals.");
  }

  const now = new Date();
  const currentEnd = new Date(currentMembership.end_date);
  const newEndDate = currentEnd > now
    ? new Date(currentEnd.getTime() + durationDays * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const { data: renewed, error: updateError } = await supabase
    .from("memberships")
    .insert({
      gym_id: scope.gymId,
      branch_id: scope.branchId,
      organization_id: scope.scopedOrganizationId ?? scope.organizationId,
      member_id: currentMembership.member_id,
      membership_plan_id: plan.id,
      status: "active",
      start_date: now.toISOString(),
      end_date: newEndDate.toISOString(),
      price_amount: plan.price_amount ?? currentMembership.price_amount,
      source: "reception_renewal",
      renewal_of_membership_id: currentMembership.id,
      created_by: scope.userId,
      payment_status: "pending",
      activated_at: now.toISOString()
    })
    .select("*")
    .maybeSingle();

  if (updateError) return errorState(updateError.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "membership.renewed_front_desk",
    entityType: "membership",
    entityId: renewed?.id ?? "",
    metadata: {
      previousMembershipId: membershipId,
      memberId: member.id,
      membershipPlanId: plan.id,
    }
  });

  revalidatePath("/reception/memberships");
  return successState("Membership renewed successfully.");
}

export async function freezeMembershipFrontDeskAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/memberships");

  const membershipId = formData.get("membershipId") as string;
  const reason = formData.get("reason") as string;

  if (!membershipId) return errorState("Membership ID is required.");
  if (!reason || reason.trim().length < 3) return errorState("Please provide a reason for freezing.");

  const supabase = await createSupabaseServerClient();
  let membership;
  try {
    membership = await requireScopedMembership(supabase, membershipId, scope);
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to validate this membership."));
  }
  if (membership.status !== "active") return errorState("Only active memberships can be frozen.");

  const { error: updateError } = await supabase
    .from("memberships")
    .update({
      status: "frozen",
      frozen_at: new Date().toISOString(),
      notes: reason,
      updated_by: scope.userId,
      updated_at: new Date().toISOString()
    })
    .eq("id", membershipId)
    .eq("gym_id", scope.gymId);

  if (updateError) return errorState(updateError.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "membership.frozen_front_desk",
    entityType: "membership",
    entityId: membershipId,
    metadata: { reason }
  });

  revalidatePath("/reception/memberships");
  return successState("Membership frozen.");
}

export async function cancelMembershipFrontDeskAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/memberships");

  const membershipId = formData.get("membershipId") as string;
  const reason = formData.get("reason") as string;

  if (!membershipId) return errorState("Membership ID is required.");
  if (!reason || reason.trim().length < 3) return errorState("Please provide a reason for cancellation.");

  const supabase = await createSupabaseServerClient();
  let membership;
  try {
    membership = await requireScopedMembership(supabase, membershipId, scope);
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to validate this membership."));
  }
  if (!["active", "frozen", "pending"].includes(membership.status)) {
    return errorState("This membership cannot be cancelled from the front desk.");
  }

  const { error: updateError } = await supabase
    .from("memberships")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      notes: reason,
      updated_by: scope.userId,
      updated_at: new Date().toISOString()
    })
    .eq("id", membershipId)
    .eq("gym_id", scope.gymId);

  if (updateError) return errorState(updateError.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "membership.cancelled_front_desk",
    entityType: "membership",
    entityId: membershipId,
    metadata: { reason }
  });

  revalidatePath("/reception/memberships");
  return successState("Membership cancelled.");
}
