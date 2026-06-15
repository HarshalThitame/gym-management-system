/**
 * Enterprise Sales Pipeline Engine
 * Lead management, follow-ups, assignments, reminders, conversion flow
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

export type LeadInput = {
  organizationId: string;
  gymId: string;
  branchId?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  sourceCode?: string;
  notes?: string;
  assignedTo?: string;
};

export type FollowUpInput = {
  leadId: string;
  organizationId: string;
  action: string;
  notes?: string;
  dueAt?: string;
  assignedTo?: string;
};

// ── Lead CRUD ────────────────────────────────────────────────

export async function createLead(input: LeadInput) {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      insert(r: Record<string, unknown>): {
        select(c: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  };

  // Get default "new" status
  const { data: statuses } = await (supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  }).from("crm_lead_statuses").select("id").eq("code", "new");

  const defaultStatus = (statuses ?? [])[0] as Record<string, unknown> | undefined;

  // Get source
  let sourceId: string | null = null;
  if (input.sourceCode) {
    const { data: sources } = await (supabase as never as {
      from(t: string): {
        select(c: string): {
          eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
        };
      };
    }).from("crm_lead_sources").select("id").eq("code", input.sourceCode);
    sourceId = ((sources ?? [])[0] as Record<string, unknown> | undefined)?.id as string ?? null;
  }

  const { data: lead } = await s.from("crm_leads").insert({
    organization_id: input.organizationId,
    gym_id: input.gymId,
    branch_id: input.branchId ?? null,
    first_name: input.firstName,
    last_name: input.lastName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    status_id: defaultStatus?.id ?? null,
    source_id: sourceId,
    assigned_to: input.assignedTo ?? null,
  }).select("id");

  return (lead ?? [])[0] as Record<string, unknown> | undefined;
}

export async function updateLeadStatus(leadId: string, statusCode: string, organizationId: string, actorId: string) {
  const supabase = await createSupabaseServerClient();

  // Get existing lead and new status
  const { data: statuses } = await (supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  }).from("crm_lead_statuses").select("id, name").eq("code", statusCode);

  const newStatus = (statuses ?? [])[0] as Record<string, unknown> | undefined;
  if (!newStatus) throw new Error(`Status '${statusCode}' not found`);

  const updateData: Record<string, unknown> = { status_id: newStatus.id };

  // Handle special status transitions
  if (statusCode === "converted") updateData.converted_at = new Date().toISOString();
  if (statusCode === "lost") { updateData.lost_at = new Date().toISOString(); updateData.lost_reason = null; }

  const { error } = await (supabase as never as {
    from(t: string): {
      update(r: Record<string, unknown>): {
        eq(k: string, v: string): Promise<{ error: { message: string } | null }>;
      };
    };
  }).from("crm_leads").update(updateData).eq("id", leadId);

  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorId,
    action: `crm.lead_status.${statusCode}` as const,
    entityType: "crm_lead",
    entityId: leadId,
    metadata: { statusName: newStatus.name, organizationId } as never,
  });
}

export async function assignLead(leadId: string, assigneeId: string, actorId: string) {
  const supabase = await createSupabaseServerClient();

  const { error } = await (supabase as never as {
    from(t: string): {
      update(r: Record<string, unknown>): {
        eq(k: string, v: string): Promise<{ error: { message: string } | null }>;
      };
    };
  }).from("crm_leads").update({ assigned_to: assigneeId }).eq("id", leadId);

  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorId,
    action: "crm.lead_assigned",
    entityType: "crm_lead",
    entityId: leadId,
    metadata: { assignedTo: assigneeId },
  });
}

// ── Follow-ups ───────────────────────────────────────────────

export async function createFollowUp(input: FollowUpInput) {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      insert(r: Record<string, unknown>): {
        select(c: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  };

  const { data: followup } = await s.from("crm_followups").insert({
    lead_id: input.leadId,
    organization_id: input.organizationId,
    action: input.action,
    notes: input.notes ?? null,
    due_at: input.dueAt ?? null,
    assigned_to: input.assignedTo ?? null,
  }).select("id");

  return (followup ?? [])[0] as Record<string, unknown> | undefined;
}

export async function completeFollowUp(followUpId: string) {
  const supabase = await createSupabaseServerClient();

  const { error } = await (supabase as never as {
    from(t: string): {
      update(r: Record<string, unknown>): {
        eq(k: string, v: string): Promise<{ error: { message: string } | null }>;
      };
    };
  }).from("crm_followups").update({
    completed_at: new Date().toISOString(),
  }).eq("id", followUpId);

  if (error) throw new Error(error.message);
}

// ── Conversion Flow ──────────────────────────────────────────

export async function convertLeadToMember(
  leadId: string,
  memberInput: { gymId: string; fullName: string; phone: string; membershipPlanId?: string },
  actorId: string,
) {
  const supabase = await createSupabaseServerClient();

  // Get lead details
  const { data: leads } = await (supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  }).from("crm_leads").select("organization_id, first_name, last_name, email, phone").eq("id", leadId);

  const lead = (leads ?? [])[0] as Record<string, unknown> | undefined;
  if (!lead) throw new Error("Lead not found");

  // Create member record
  const { data: member } = await (supabase as never as {
    from(t: string): {
      insert(r: Record<string, unknown>): {
        select(c: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  }).from("members").insert({
    organization_id: lead.organization_id as string,
    gym_id: memberInput.gymId,
    full_name: memberInput.fullName,
    phone: memberInput.phone,
    email: lead.email as string ?? null,
    status: "active",
    joined_at: new Date().toISOString(),
  }).select("id");

  const memberId = (member ?? [])[0]?.id as string | undefined;
  if (!memberId) throw new Error("Failed to create member");

  // Update lead as converted
  await updateLeadStatus(leadId, "converted", lead.organization_id as string, actorId);

  // Link member to lead
  const { error } = await (supabase as never as {
    from(t: string): {
      update(r: Record<string, unknown>): {
        eq(k: string, v: string): Promise<{ error: { message: string } | null }>;
      };
    };
  }).from("crm_leads").update({
    converted_member_id: memberId,
    converted_at: new Date().toISOString(),
  }).eq("id", leadId);

  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorId,
    action: "crm.lead_converted_to_member",
    entityType: "crm_lead",
    entityId: leadId,
    metadata: { memberId },
  });

  return { leadId, memberId };
}

// ── Pipeline Analytics ───────────────────────────────────────

export async function getPipelineSummary(organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: leads } = await (supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  }).from("crm_leads").select("id, status_id").eq("organization_id", organizationId);

  // Get status names
  const { data: statuses } = await (supabase as never as {
    from(t: string): {
      select(c: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
    };
  }).from("crm_lead_statuses").select("id, code, name");

  const statusMap = new Map((statuses ?? []).map((s) => [s.id as string, s]));
  const counts: Record<string, number> = {};

  for (const lead of (leads ?? [])) {
    const status = statusMap.get(lead.status_id as string);
    const code = (status?.code as string) ?? "unknown";
    counts[code] = (counts[code] ?? 0) + 1;
  }

  return {
    total: (leads ?? []).length,
    byStatus: counts,
    newLeads: counts["new"] ?? 0,
    converted: counts["converted"] ?? 0,
    lost: counts["lost"] ?? 0,
  };
}

// ── Daily Task Summary ───────────────────────────────────────

export async function getDailyTasks(organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: followups } = await (supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  }).from("crm_followups").select("id, action, due_at, completed_at").eq("organization_id", organizationId);

  const all = (followups ?? []) as Array<Record<string, unknown>>;
  return {
    total: all.length,
    overdue: all.filter((f) => !f.completed_at && f.due_at && new Date(f.due_at as string) < new Date()).length,
    today: all.filter((f) => f.due_at && new Date(f.due_at as string) >= today && new Date(f.due_at as string) < tomorrow).length,
    completed: all.filter((f) => f.completed_at).length,
    pending: all.filter((f) => !f.completed_at).length,
  };
}
