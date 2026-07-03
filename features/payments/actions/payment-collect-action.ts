"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { toMinorUnits } from "@/features/billing/lib/money";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { requireReceptionScope } from "@/features/reception/lib/access";
import {
  buildOperationalReference,
  findRecentDuplicatePayment,
  requireScopedMember,
  requireScopedMembership,
  toOperationErrorMessage,
} from "@/features/reception/lib/operation-guards";

function successState(message: string, data?: Record<string, string>): AuthActionState {
  return { status: "success", message, success: true, ...data };
}

function errorState(message: string): AuthActionState {
  return { status: "error", message, success: false };
}

export async function collectPaymentAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/payments");

  const memberId = formData.get("memberId") as string;
  const amount = formData.get("amount") as string;
  const method = formData.get("method") as string;
  const paymentType = formData.get("paymentType") as string;
  const notes = formData.get("notes") as string;
  const membershipId = formData.get("membershipId") as string;

  if (!memberId) return errorState("Please select a member.");
  if (!amount || Number(amount) <= 0) return errorState("Enter a valid amount.");

  const amountInMinor = toMinorUnits(amount);

  const supabase = await createSupabaseServerClient();
  let member;
  let membership = null;
  try {
    member = await requireScopedMember(supabase, memberId, scope);
    membership = membershipId ? await requireScopedMembership(supabase, membershipId, scope) : null;
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to validate the selected member."));
  }

  if (membership && membership.member_id !== member.id) {
    return errorState("The selected membership does not belong to this member.");
  }

  const duplicatePayment = await findRecentDuplicatePayment(supabase, scope, {
    amount: amountInMinor,
    method: method || "cash",
    paymentType: paymentType || "other",
    memberId: member.id,
    membershipId: membership?.id ?? null,
    createdBy: scope.userId,
  });

  if (duplicatePayment) {
    return errorState(`A matching payment was already recorded recently (${duplicatePayment.payment_number ?? duplicatePayment.id}).`);
  }

  const paymentNumber = buildOperationalReference("PAY-FD");
  const receiptNumber = buildOperationalReference("REC");
  const collectedAt = new Date().toISOString();

  const payload = {
    gym_id: scope.gymId,
    branch_id: scope.branchId,
    organization_id: scope.scopedOrganizationId ?? scope.organizationId,
    member_id: member.id,
    membership_id: membership?.id ?? null,
    amount: amountInMinor,
    currency: "INR",
    method: method || "cash",
    payment_number: paymentNumber,
    payment_type: paymentType || "other",
    provider: "reception",
    status: "paid",
    receipt_number: receiptNumber,
    payment_method: method,
    paid_at: collectedAt,
    collected_at: collectedAt,
    created_by: scope.userId,
    metadata: {
      source: "front_desk",
      collectedByRole: scope.primaryRole,
      collectedForMemberCode: member.member_code,
      notes: notes || null,
    }
  };

  const { data, error } = await supabase
    .from("payments")
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error) return errorState(error.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "payment.collect",
    entityType: "payment",
    entityId: data?.id ?? "",
    metadata: {
      amount: amountInMinor,
      method: method || "cash",
      paymentNumber,
      receiptNumber,
      memberId: member.id,
      membershipId: membership?.id ?? null,
      source: "front_desk",
    }
  });

  revalidatePath("/reception/payments");

  return successState("Payment collected successfully.", {
    paymentNumber: paymentNumber,
    receiptNumber: receiptNumber,
    amount: String(amountInMinor)
  });
}
