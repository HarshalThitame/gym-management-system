"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { requireReceptionScope } from "@/features/reception/lib/access";
import {
  buildOperationalReference,
  requireScopedLead,
  requireScopedMembershipPlan,
  toOperationErrorMessage,
} from "@/features/reception/lib/operation-guards";
import { z } from "zod";

const ConvertLeadSchema = z.object({
  leadId: z.string().uuid(),
  membershipPlanId: z.string().uuid("Select a membership plan.")
});

function successState(message: string): AuthActionState {
  return { status: "success", message, success: true };
}

function errorState(message: string): AuthActionState {
  return { status: "error", message, success: false };
}

export async function convertLeadAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/leads");

  const parsed = ConvertLeadSchema.safeParse({
    leadId: formData.get("leadId") ?? "",
    membershipPlanId: formData.get("membershipPlanId") ?? ""
  });

  if (!parsed.success) {
    return { status: "error", message: "Validation failed.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  let lead;
  let plan;
  try {
    lead = await requireScopedLead(supabase, parsed.data.leadId, scope);
    plan = await requireScopedMembershipPlan(supabase, parsed.data.membershipPlanId, scope);
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to validate this conversion request."));
  }
  if (lead.status === "converted") return errorState("Lead is already converted.");

  const duplicateMemberQuery = supabase
    .from("members")
    .select("id")
    .eq("gym_id", scope.gymId)
    .eq("phone", lead.phone)
    .limit(1);
  if (scope.branchId) {
    duplicateMemberQuery.eq("branch_id", scope.branchId);
  }
  const { data: duplicateMembers, error: duplicateMemberError } = await duplicateMemberQuery;
  if (duplicateMemberError) return errorState(duplicateMemberError.message);
  if ((duplicateMembers ?? []).length > 0) {
    return errorState("A member with this phone number already exists in your branch.");
  }

  const memberCode = buildOperationalReference("MBR");
  if (plan.status !== "active") return errorState("Only active membership plans can be used.");

  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      gym_id: scope.gymId,
      branch_id: scope.branchId,
      organization_id: scope.scopedOrganizationId ?? scope.organizationId,
      full_name: lead.name,
      phone: lead.phone,
      email: lead.email,
      member_code: memberCode,
      gender: "other",
      joined_at: new Date().toISOString()
    })
    .select("*")
    .maybeSingle();

  if (memberError) return errorState(memberError.message);

  const now = new Date();
  const endDate = new Date(now.getTime() + (plan.duration_days ?? 30) * 24 * 60 * 60 * 1000);

  const { error: membershipError } = await supabase.from("memberships").insert({
    gym_id: scope.gymId,
    member_id: member?.id ?? "",
    membership_plan_id: plan.id,
    status: "active",
    start_date: now.toISOString(),
    end_date: endDate.toISOString(),
    price_amount: plan.price_amount ?? 0,
    source: "lead_conversion",
    payment_status: "pending",
    activated_at: now.toISOString(),
    created_by: scope.userId
  });

  if (membershipError) return errorState(membershipError.message);

  await supabase
    .from("leads")
    .update({
      status: "converted",
      notes: `Converted to member ${memberCode} at ${new Date().toLocaleString("en-IN")}`,
      updated_at: now.toISOString()
    })
    .eq("id", lead.id);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "lead.converted",
    entityType: "lead",
    entityId: lead.id,
    metadata: {
      memberCode,
      memberId: member?.id ?? "",
      membershipPlanId: plan.id,
    }
  });

  revalidatePath("/reception/leads");
  revalidatePath("/reception/members");
  return successState(`Lead converted to member (${memberCode}).`);
}
