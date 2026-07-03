"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { assertLeadTransition, requireScopedLead, toOperationErrorMessage } from "@/features/reception/lib/operation-guards";
import { LeadSchema, UpdateLeadStatusSchema } from "../schemas/lead-schemas";

function validationState(fieldErrors: Record<string, string[]>): AuthActionState {
  return { status: "error", message: "Validation failed.", fieldErrors };
}

function successState(message: string): AuthActionState {
  return { status: "success", message, success: true };
}

function errorState(message: string): AuthActionState {
  return { status: "error", message, success: false };
}

export async function saveLeadAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/leads");

  const parsed = LeadSchema.safeParse({
    leadId: formData.get("leadId") ?? "",
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    source: formData.get("source") ?? "walk_in",
    interest: formData.get("interest") ?? "",
    message: formData.get("message") ?? "",
    notes: formData.get("notes") ?? "",
    preferredTrialAt: formData.get("preferredTrialAt") ?? "",
    consentMarketing: formData.get("consentMarketing") === "on"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const isUpdate = !!parsed.data.leadId;
  let currentLead = null;
  try {
    currentLead = isUpdate ? await requireScopedLead(supabase, parsed.data.leadId, scope) : null;
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Unable to validate this lead."));
  }

  if (currentLead?.status === "converted") {
    return errorState("Converted leads must be managed from the member profile.");
  }

  const payload = {
    gym_id: scope.gymId,
    branch_id: scope.branchId,
    organization_id: scope.scopedOrganizationId ?? scope.organizationId,
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: parsed.data.email || null,
    source: parsed.data.source,
    interest: parsed.data.interest || null,
    message: parsed.data.message || "Lead captured at reception.",
    notes: parsed.data.notes || null,
    preferred_trial_at: parsed.data.preferredTrialAt || null,
    consent_marketing: parsed.data.consentMarketing,
    updated_at: new Date().toISOString()
  };

  const result = isUpdate
    ? await supabase
        .from("leads")
        .update(payload)
        .eq("id", parsed.data.leadId)
        .eq("gym_id", scope.gymId)
        .select("*")
        .maybeSingle()
    : await supabase
        .from("leads")
        .insert({
          ...payload,
          status: "new",
          message: parsed.data.message || "Lead captured at reception."
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
    action: isUpdate ? "lead.update" : "lead.create",
    entityType: "lead",
    entityId: result.data?.id ?? parsed.data.leadId ?? "",
    metadata: { name: parsed.data.name, phone: parsed.data.phone }
  });

  revalidatePath("/reception/leads");
  return successState(isUpdate ? "Lead updated." : "Lead created.");
}

export async function updateLeadStatusAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireReceptionScope("/reception/leads");

  const parsed = UpdateLeadStatusSchema.safeParse({
    leadId: formData.get("leadId") ?? "",
    status: formData.get("status") ?? "",
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  let lead;
  try {
    lead = await requireScopedLead(supabase, parsed.data.leadId, scope);

    assertLeadTransition(lead.status, parsed.data.status);
  } catch (error) {
    return errorState(toOperationErrorMessage(error, "Lead status update is not allowed."));
  }

  const updatePayload: Record<string, unknown> = {
    status: parsed.data.status,
    last_contacted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (parsed.data.notes) {
    updatePayload.notes = parsed.data.notes;
  }

  const { error } = await supabase
    .from("leads")
    .update(updatePayload)
    .eq("id", parsed.data.leadId)
    .eq("gym_id", scope.gymId);

  if (error) return errorState(error.message);

  await writeAuditLog({
    actorId: scope.userId,
    gymId: scope.gymId,
    branchId: scope.branchId,
    action: "lead.status_update",
    entityType: "lead",
    entityId: parsed.data.leadId,
    metadata: {
      previousStatus: lead.status,
      status: parsed.data.status,
    }
  });

  revalidatePath("/reception/leads");
  return successState(`Lead status updated to ${parsed.data.status.replaceAll("_", " ")}.`);
}
