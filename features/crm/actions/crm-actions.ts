"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import {
  LeadSchema,
  LeadStatusSchema,
  LeadSourceSchema,
  FollowupSchema,
  ConvertLeadSchema
} from "../schemas/crm";

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value && value.length > 0)) as Record<string, string[]>
  };
}

export async function saveLeadAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/crm");
  if (!scope.organizationId) {
    return { status: "error", message: "Organization scope required." };
  }

  const parsed = LeadSchema.safeParse({
    leadId: formData.get("leadId") ?? "",
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    gender: formData.get("gender") ?? "",
    referralSource: formData.get("referralSource") ?? "",
    interestedIn: formData.get("interestedIn") ?? "",
    budgetRange: formData.get("budgetRange") ?? "",
    notes: formData.get("notes") ?? "",
    followUpDate: formData.get("followUpDate") ?? "",
    assignedTo: formData.get("assignedTo") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const leadId = parsed.data.leadId || null;

  const payload = {
    organization_id: scope.organizationId,
    gym_id: scope.gymId,
    branch_id: scope.branchId,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    date_of_birth: parsed.data.dateOfBirth || null,
    gender: parsed.data.gender || null,
    referral_source: parsed.data.referralSource || null,
    interested_in: parsed.data.interestedIn ? parsed.data.interestedIn.split(",").map((s) => s.trim()).filter(Boolean) : null,
    budget_range: parsed.data.budgetRange || null,
    notes: parsed.data.notes || null,
    follow_up_date: parsed.data.followUpDate || null,
    assigned_to: parsed.data.assignedTo || null
  } as any;

  if (leadId) {
    const { error } = await supabase.from("crm_leads").update(payload).eq("id", leadId);
    if (error) return { status: "error", message: error.message };
    await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "update", entityType: "crm_leads", entityId: leadId, metadata: payload });
  } else {
    const { data, error } = await supabase.from("crm_leads").insert(payload).select("id").maybeSingle();
    if (error) return { status: "error", message: error.message };
    await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "create", entityType: "crm_leads", entityId: data?.id ?? null, metadata: payload });
  }

  revalidatePath("/admin/crm");
  return { status: "success", message: leadId ? "Lead updated." : "Lead created." };
}

export async function saveLeadStatusAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/crm");

  const parsed = LeadStatusSchema.safeParse({
    statusId: formData.get("statusId") ?? "",
    name: formData.get("name"),
    code: formData.get("code"),
    sortOrder: formData.get("sortOrder") ?? "0"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const statusId = parsed.data.statusId || null;

  const payload = {
    name: parsed.data.name,
    code: parsed.data.code,
    sort_order: parsed.data.sortOrder,
    is_active: true
  } as any;

  if (statusId) {
    const { error } = await supabase.from("crm_lead_statuses").update(payload).eq("id", statusId);
    if (error) return { status: "error", message: error.message };
  } else {
    const { error } = await supabase.from("crm_lead_statuses").insert(payload);
    if (error) return { status: "error", message: error.message };
  }

  revalidatePath("/admin/crm");
  return { status: "success", message: statusId ? "Status updated." : "Status created." };
}

export async function saveLeadSourceAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/crm");

  const parsed = LeadSourceSchema.safeParse({
    sourceId: formData.get("sourceId") ?? "",
    name: formData.get("name"),
    code: formData.get("code") ?? formData.get("name")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const sourceId = parsed.data.sourceId || null;

  const payload = {
    name: parsed.data.name,
    code: parsed.data.code ?? parsed.data.name.toLowerCase().replace(/\s+/g, "_"),
    is_active: true
  } as any;

  if (sourceId) {
    const { error } = await supabase.from("crm_lead_sources").update(payload).eq("id", sourceId);
    if (error) return { status: "error", message: error.message };
  } else {
    const { error } = await supabase.from("crm_lead_sources").insert(payload);
    if (error) return { status: "error", message: error.message };
  }

  revalidatePath("/admin/crm");
  return { status: "success", message: sourceId ? "Source updated." : "Source created." };
}

export async function updateLeadStatusAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/crm");
  const leadId = formData.get("leadId");
  const statusId = formData.get("statusId");

  if (!leadId || typeof leadId !== "string") {
    return { status: "error", message: "Lead ID is required." };
  }
  if (!statusId || typeof statusId !== "string") {
    return { status: "error", message: "Status ID is required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("crm_leads")
    .update({ status_id: statusId })
    .eq("id", leadId)
    .eq("gym_id", scope.gymId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "update_status", entityType: "crm_leads", entityId: leadId, metadata: { statusId } });
  revalidatePath("/admin/crm");
  return { status: "success", message: "Lead status updated." };
}

export async function saveFollowupAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/crm");

  const parsed = FollowupSchema.safeParse({
    leadId: formData.get("leadId"),
    notes: formData.get("notes"),
    followUpDate: formData.get("followUpDate") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    lead_id: parsed.data.leadId,
    notes: parsed.data.notes,
    due_at: parsed.data.followUpDate || null,
    action: "follow_up",
    organization_id: scope.organizationId
  } as any;

  const { error } = await supabase.from("crm_followups").insert(payload);
  if (error) return { status: "error", message: error.message };

  // Update lead follow-up date
  if (parsed.data.followUpDate) {
    await supabase.from("crm_leads").update({ follow_up_date: parsed.data.followUpDate }).eq("id", parsed.data.leadId);
  }

  await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "add_followup", entityType: "crm_followups", entityId: null, metadata: { leadId: parsed.data.leadId } });
  revalidatePath("/admin/crm");
  return { status: "success", message: "Follow-up added." };
}

export async function convertLeadAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/crm");

  const parsed = ConvertLeadSchema.safeParse({
    leadId: formData.get("leadId"),
    planId: formData.get("planId")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  // Get lead details
  const { data: lead, error: leadError } = await supabase
    .from("crm_leads")
    .select("*")
    .eq("id", parsed.data.leadId)
    .eq("gym_id", scope.gymId)
    .maybeSingle();

  if (leadError || !lead) {
    return { status: "error", message: "Lead not found." };
  }

  // Create member from lead
  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      gym_id: scope.gymId,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      date_of_birth: lead.date_of_birth,
      gender: lead.gender,
      referral_source: lead.referral_source
    } as any)
    .select("id")
    .maybeSingle();

  if (memberError || !member) {
    return { status: "error", message: memberError?.message ?? "Failed to create member." };
  }

  // Update lead as converted
  const { error: updateError } = await supabase
    .from("crm_leads")
    .update({
      converted_at: new Date().toISOString(),
      converted_member_id: member.id
    })
    .eq("id", parsed.data.leadId);

  if (updateError) {
    return { status: "error", message: updateError.message };
  }

  await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "convert_lead", entityType: "crm_leads", entityId: parsed.data.leadId, metadata: { memberId: member.id, planId: parsed.data.planId } });
  revalidatePath("/admin/crm");
  revalidatePath("/admin/members");
  return { status: "success", message: "Lead converted to member." };
}

export async function markLeadLostAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const scope = await requireGymAdminScope("/admin/crm");
  const leadId = formData.get("leadId");
  const reason = formData.get("reason");

  if (!leadId || typeof leadId !== "string") {
    return { status: "error", message: "Lead ID is required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("crm_leads")
    .update({
      lost_at: new Date().toISOString(),
      lost_reason: reason?.toString() || null
    })
    .eq("id", leadId)
    .eq("gym_id", scope.gymId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAuditLog({ gymId: scope.gymId, actorId: scope.userId, action: "mark_lost", entityType: "crm_leads", entityId: leadId, metadata: { reason: reason?.toString() } });
  revalidatePath("/admin/crm");
  return { status: "success", message: "Lead marked as lost." };
}
