"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrgFeatureAccess } from "@/features/entitlement";
import { sendEmail } from "@/services/email/resend";
import { getOrgEmailConfigOrDefault } from "@/services/email/email-config-service";
import { triggerWebhook } from "@/features/webhooks/trigger";
import type { LeadRow } from "@/features/organization-owner/services/lead-service";
import type { Database, Json } from "@/types/database";

export type LeadTaskRow = Database["public"]["Tables"]["lead_tasks"]["Row"] & { leadName?: string };
export type AutomationRuleRow = Database["public"]["Tables"]["lead_automation_rules"]["Row"];
export type PipelineColumn = { status: string; leads: LeadRow[]; count: number };
export type PipelineView = { columns: PipelineColumn[]; total: number; conversionRate: number; avgDaysToConvert: number | null };
export type ConversionForecast = { estimatedConversions: number; confidencePercent: number; basedOnPeriodDays: number };

type LeadFilters = {
  q: string | undefined;
  status: string | undefined;
  source: string | undefined;
  page: number | undefined;
  pageSize: number | undefined;
};

type LeadResult = {
  leads: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getOrgLeads(
  organizationId: string,
  filters: LeadFilters
): Promise<LeadResult> {
  await requireOrgFeatureAccess(organizationId, "lead_management");

  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters.pageSize ?? 12));

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = gyms?.map((g) => g.id) ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from("leads").select("*", { count: "exact" });

  if (gymIds.length > 0) {
    query = query.in("gym_id", gymIds);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }

  if (filters.q) {
    query = query.or(
      `name.ilike.%${filters.q}%,phone.ilike.%${filters.q}%,email.ilike.%${filters.q}%`
    );
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  return {
    leads: (data ?? []) as LeadRow[],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function updateLeadStatus(
  organizationId: string,
  leadId: string,
  status: string,
  notes?: string
): Promise<LeadRow> {
  await requireOrgFeatureAccess(organizationId, "lead_management");

  const supabase = await createSupabaseServerClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (!lead) throw new Error("Lead not found");

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = gyms?.map((g) => g.id) ?? [];
  if (lead.gym_id && !gymIds.includes(lead.gym_id)) {
    throw new Error("Lead not in your organization");
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status,
    updated_at: now,
    last_contacted_at: now,
  };
  if (notes !== undefined) update.notes = notes;

  const [leadUpdate] = await Promise.all([
    supabase
      .from("leads")
      .update(update as never)
      .eq("id", leadId)
      .select("*")
      .single(),
    calculateLeadScore(leadId),
  ]);

  const { data: updated, error } = leadUpdate;
  if (error) throw new Error(error.message);

  // Fire-and-forget webhook (never blocks)
  triggerWebhook(organizationId, "lead.updated", { leadId, status, name: lead.name, phone: lead.phone }).catch(() => {});

  return updated as LeadRow;
}

export async function convertLeadToMember(
  organizationId: string,
  leadId: string,
  gymId: string
): Promise<{ memberId: string; lead: LeadRow }> {
  await requireOrgFeatureAccess(organizationId, "lead_management");

  const supabase = await createSupabaseServerClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (!lead) throw new Error("Lead not found");

  const { data: gym } = await supabase
    .from("gyms")
    .select("id, organization_id")
    .eq("id", gymId)
    .single();

  if (!gym || gym.organization_id !== organizationId) {
    throw new Error("Gym not in your organization");
  }

  const memberCode = `MEM-${Date.now().toString(36).toUpperCase()}`;

  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      gym_id: gymId,
      full_name: lead.name,
      phone: lead.phone,
      email: lead.email,
      status: "active",
      member_code: memberCode,
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (memberError) throw new Error(memberError.message);

  const { data: updatedLead, error: leadError } = await supabase
    .from("leads")
    .update({ status: "converted", updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .select("*")
    .single();

  if (leadError) throw new Error(leadError.message);

  revalidatePath("/organization/leads");
  revalidatePath("/organization/members");

  // Fire-and-forget webhook (never blocks)
  triggerWebhook(organizationId, "lead.converted", { leadId, memberId: member.id, name: lead.name, gymId }).catch(() => {});

  return { memberId: member.id, lead: updatedLead as LeadRow };
}

export async function getOrgNewLeadsCount(organizationId: string): Promise<number> {
  await requireOrgFeatureAccess(organizationId, "lead_management");

  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = gyms?.map((g) => g.id) ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("leads")
    .select("id", { count: "exact" })
    .gte("created_at", startOfMonth);

  if (gymIds.length > 0) {
    query = query.in("gym_id", gymIds);
  }

  const { count } = await query;
  return count ?? 0;
}

export async function deleteLead(
  organizationId: string,
  leadId: string
): Promise<void> {
  await requireOrgFeatureAccess(organizationId, "lead_management");

  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead } = await supabase
    .from("leads" as any)
    .select("id, gym_id")
    .eq("id", leadId)
    .single() as { data: { id: string; gym_id: string | null } | null; error: unknown };

  if (!lead) throw new Error("Lead not found");

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = gyms?.map((g) => g.id) ?? [];
  if (lead.gym_id && !gymIds.includes(lead.gym_id)) {
    throw new Error("Lead not in your organization");
  }

  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw new Error(error.message);

  revalidatePath("/organization/leads");
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3.3: Advanced CRM — Follow-up Tasks
// ═══════════════════════════════════════════════════════════════════════════

export async function getLeadTasks(
  organizationId: string,
  leadId?: string
): Promise<LeadTaskRow[]> {
  await requireOrgFeatureAccess(organizationId, "lead_followup_reminders");

  const supabase = await createSupabaseServerClient();
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);
  const gymIds = gyms?.map((g) => g.id) ?? [];

  const getGymIdsForLead = async (lid: string) => {
    const { data: l } = await supabase.from("leads").select("gym_id").eq("id", lid).single();
    return (gymIds.length === 0 || (l?.gym_id && gymIds.includes(l.gym_id))) ?? false;
  };

  if (leadId) {
    const isValid = await getGymIdsForLead(leadId);
    if (!isValid) return [];
  }

  let query = supabase.from("lead_tasks").select("*").eq("organization_id", organizationId);
  if (leadId) query = query.eq("lead_id", leadId);
  query = query.order("due_date");

  const { data: tasks } = await query;
  if (!tasks?.length) return [];

  const leadIds = [...new Set(tasks.map((t) => t.lead_id))];
  const { data: leads } = await supabase.from("leads").select("id, name").in("id", leadIds);
  const nameMap = new Map((leads ?? []).map((l) => [l.id, l.name]));

  return (tasks as LeadTaskRow[]).map((t) => ({ ...t, leadName: nameMap.get(t.lead_id) ?? "Unknown" }));
}

export async function createLeadTask(
  organizationId: string,
  data: {
    leadId: string;
    title: string;
    description?: string;
    dueDate: string;
    assignedTo?: string;
  }
): Promise<LeadTaskRow> {
  await requireOrgFeatureAccess(organizationId, "lead_followup_reminders");

  const supabase = await createSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("lead_tasks")
    .insert({
      organization_id: organizationId,
      lead_id: data.leadId,
      title: data.title,
      description: data.description ?? null,
      due_date: data.dueDate,
      assigned_to: data.assignedTo ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return inserted as LeadTaskRow;
}

export async function completeLeadTask(
  organizationId: string,
  taskId: string
): Promise<LeadTaskRow> {
  await requireOrgFeatureAccess(organizationId, "lead_followup_reminders");

  const supabase = await createSupabaseServerClient();
  const { data: updated, error } = await supabase
    .from("lead_tasks")
    .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  await calculateLeadScoreForTaskCompletion(organizationId, updated.lead_id);
  return updated as LeadTaskRow;
}

export async function updateLeadTask(
  organizationId: string,
  taskId: string,
  data: {
    title?: string;
    description?: string;
    dueDate?: string;
    assignedTo?: string | null;
  }
): Promise<LeadTaskRow> {
  await requireOrgFeatureAccess(organizationId, "lead_followup_reminders");

  const supabase = await createSupabaseServerClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.dueDate !== undefined) update.due_date = data.dueDate;
  if (data.assignedTo !== undefined) update.assigned_to = data.assignedTo;

  const { data: updated, error } = await supabase
    .from("lead_tasks")
    .update(update as never)
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return updated as LeadTaskRow;
}

export async function deleteLeadTask(
  organizationId: string,
  taskId: string
): Promise<void> {
  await requireOrgFeatureAccess(organizationId, "lead_followup_reminders");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("lead_tasks")
    .delete()
    .eq("id", taskId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}

export async function getOverdueTasks(organizationId: string): Promise<LeadTaskRow[]> {
  await requireOrgFeatureAccess(organizationId, "lead_followup_reminders");

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data: tasks } = await supabase
    .from("lead_tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .lt("due_date", now)
    .is("completed_at", null)
    .order("due_date");

  if (!tasks?.length) return [];

  const leadIds = [...new Set(tasks.map((t) => t.lead_id))];
  const { data: leads } = await supabase.from("leads").select("id, name").in("id", leadIds);
  const nameMap = new Map((leads ?? []).map((l) => [l.id, l.name]));

  return (tasks as LeadTaskRow[]).map((t) => ({ ...t, leadName: nameMap.get(t.lead_id) ?? "Unknown" }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3.3: Advanced CRM — Re-engagement Automation
// ═══════════════════════════════════════════════════════════════════════════

export async function getAutomationRules(
  organizationId: string
): Promise<AutomationRuleRow[]> {
  await requireOrgFeatureAccess(organizationId, "re_engagement_automation");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("lead_automation_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at");

  return (data ?? []) as AutomationRuleRow[];
}

export async function createAutomationRule(
  organizationId: string,
  data: {
    name: string;
    triggerType: string;
    triggerValue: number;
    actionType: string;
    actionConfig: Record<string, unknown>;
  }
): Promise<AutomationRuleRow> {
  await requireOrgFeatureAccess(organizationId, "re_engagement_automation");

  const supabase = await createSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("lead_automation_rules")
    .insert({
      organization_id: organizationId,
      name: data.name,
      trigger_type: data.triggerType as "inactive_days" | "status_stale" | "new_lead",
      trigger_value: data.triggerValue,
      action_type: data.actionType as "send_email" | "send_sms" | "send_whatsapp" | "create_task" | "change_status",
      action_config: data.actionConfig as Json,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return inserted as AutomationRuleRow;
}

export async function updateAutomationRule(
  organizationId: string,
  ruleId: string,
  data: {
    name?: string;
    triggerType?: string;
    triggerValue?: number;
    actionType?: string;
    actionConfig?: Record<string, unknown>;
    isActive?: boolean;
  }
): Promise<AutomationRuleRow> {
  await requireOrgFeatureAccess(organizationId, "re_engagement_automation");

  const supabase = await createSupabaseServerClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) update.name = data.name;
  if (data.triggerType !== undefined) update.trigger_type = data.triggerType;
  if (data.triggerValue !== undefined) update.trigger_value = data.triggerValue;
  if (data.actionType !== undefined) update.action_type = data.actionType;
  if (data.actionConfig !== undefined) update.action_config = data.actionConfig;
  if (data.isActive !== undefined) update.is_active = data.isActive;

  const { data: updated, error } = await supabase
    .from("lead_automation_rules")
    .update(update as never)
    .eq("id", ruleId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return updated as AutomationRuleRow;
}

export async function deleteAutomationRule(
  organizationId: string,
  ruleId: string
): Promise<void> {
  await requireOrgFeatureAccess(organizationId, "re_engagement_automation");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("lead_automation_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}

export async function runAutomationRules(
  organizationId: string
): Promise<{ triggered: number; errors: string[] }> {
  await requireOrgFeatureAccess(organizationId, "re_engagement_automation");

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const errors: string[] = [];

  const { data: rules } = await supabase
    .from("lead_automation_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (!rules?.length) return { triggered: 0, errors: [] };

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = gyms?.map((g) => g.id) ?? [];

  const fetchLeadsForOrg = async () => {
    if (gymIds.length === 0) {
      const { data } = await supabase.from("leads").select("*").eq("organization_id", organizationId);
      return data ?? [];
    }
    const { data } = await supabase.from("leads").select("*").in("gym_id", gymIds);
    return data ?? [];
  };

  const [allLeadsRes, contacts] = await Promise.all([
    fetchLeadsForOrg(),
    supabase.from("leads").select("id, email, name").not("email", "is", null),
  ]);

  const emailMap = new Map((contacts.data ?? []).map((l) => [l.id, { email: l.email!, name: l.name }]));
  const emailConfig = await getOrgEmailConfigOrDefault(organizationId);

  let triggeredCount = 0;

  for (const rule of rules as AutomationRuleRow[]) {
    try {
      let matchingLeads: { id: string; status: string; name: string }[] = [];

      if (rule.trigger_type === "inactive_days") {
        const cutoff = new Date(Date.now() - rule.trigger_value * 24 * 60 * 60 * 1000).toISOString();
        matchingLeads = allLeadsRes
          .filter(
            (l) =>
              typeof l.status === "string" &&
              l.status !== "converted" &&
              l.status !== "lost" &&
              (!l.last_contacted_at || l.last_contacted_at < cutoff)
          )
          .map((l) => ({ id: l.id, status: l.status as string, name: l.name }));
      } else if (rule.trigger_type === "status_stale") {
        const cutoff = new Date(Date.now() - rule.trigger_value * 60 * 60 * 1000).toISOString();
        matchingLeads = allLeadsRes
          .filter(
            (l) =>
              typeof l.status === "string" &&
              l.status !== "converted" &&
              l.status !== "lost" &&
              l.updated_at < cutoff
          )
          .map((l) => ({ id: l.id, status: l.status as string, name: l.name }));
      } else if (rule.trigger_type === "new_lead") {
        const cutoff = new Date(Date.now() - rule.trigger_value * 60 * 60 * 1000).toISOString();
        matchingLeads = allLeadsRes
          .filter((l) => l.status === "new" && l.created_at >= cutoff)
          .map((l) => ({ id: l.id, status: l.status as string, name: l.name }));
      }

      for (const lead of matchingLeads) {
        try {
          const config = rule.action_config as Record<string, unknown>;

          if (rule.action_type === "send_email") {
            const contact = emailMap.get(lead.id);
            if (!contact) continue;
            const template = (config.template as string) || "Hi {{name}}, follow up with us.";
            const subject = (config.subject as string) || "Follow-up";
            const body = template.replace(/\{\{name\}\}/g, contact.name);
            await sendEmail({
              to: contact.email,
              subject,
              html: body,
              from: emailConfig.from ?? undefined,
              replyTo: emailConfig.replyTo ?? undefined,
            });
          } else if (rule.action_type === "change_status") {
            const targetStatus = (config.target_status as string) || "contacted";
            await supabase
              .from("leads")
              .update({ status: targetStatus as LeadRow["status"], last_contacted_at: now, updated_at: now })
              .eq("id", lead.id);
          } else if (rule.action_type === "create_task") {
            const taskTitle = ((config.title as string) || "Follow up with {{name}}").replace(/\{\{name\}\}/g, lead.name);
            const dueInDays = (config.due_in_days as number) || 2;
            const dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString();
            await supabase.from("lead_tasks").insert({
              organization_id: organizationId,
              lead_id: lead.id,
              title: taskTitle,
              due_date: dueDate,
            });
          }

          triggeredCount++;
        } catch {
          errors.push(`Failed to execute action for lead ${lead.id}`);
        }
      }

      await supabase
        .from("lead_automation_rules")
        .update({ last_triggered_at: now, updated_at: now })
        .eq("id", rule.id);
    } catch {
      errors.push(`Failed to process rule ${rule.name}`);
    }
  }

  return { triggered: triggeredCount, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3.3: Advanced CRM — Pipeline & Scoring
// ═══════════════════════════════════════════════════════════════════════════

export async function getPipelineView(
  organizationId: string
): Promise<PipelineView> {
  await requireOrgFeatureAccess(organizationId, "advanced_crm_lead_pipeline");

  const supabase = await createSupabaseServerClient();
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);
  const gymIds = gyms?.map((g) => g.id) ?? [];

  let query;
  if (gymIds.length > 0) {
    query = supabase.from("leads").select("*").in("gym_id", gymIds);
  } else {
    query = supabase.from("leads").select("*").eq("organization_id", organizationId);
  }

  const { data: leads } = await query.order("lead_score", { ascending: false }).order("created_at", { ascending: false });

  const allLeads = (leads ?? []) as LeadRow[];
  const pipelineStages = ["new", "contacted", "trial_scheduled", "trial_attended", "negotiation", "converted", "lost"];

  const columns: PipelineColumn[] = pipelineStages.map((status) => {
    const stageLeads = allLeads.filter((l) => l.status === status);
    return { status, leads: stageLeads, count: stageLeads.length };
  });

  const total = allLeads.length;
  const wonCount = allLeads.filter((l) => l.status === "converted").length;
  const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

  const convertedLeads = allLeads.filter((l) => l.status === "converted" && l.created_at);
  let avgDaysToConvert: number | null = null;
  if (convertedLeads.length > 0) {
    const totalDays = convertedLeads.reduce((sum, l) => {
      const created = new Date(l.created_at);
      const updated = new Date(l.updated_at);
      return sum + (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    avgDaysToConvert = Math.round(totalDays / convertedLeads.length);
  }

  return { columns, total, conversionRate, avgDaysToConvert };
}

const STATUS_SCORE: Record<string, number> = {
  new: 0,
  contacted: 10,
  trial_scheduled: 20,
  trial_attended: 30,
  negotiation: 40,
  converted: 50,
  lost: 0,
};

const SOURCE_SCORE: Record<string, number> = {
  website: 5,
  referral: 15,
  walk_in: 10,
  phone: 5,
  social_media: 0,
  other: 0,
  free_trial: 5,
  membership_inquiry: 10,
  contact: 5,
};

async function calculateLeadScore(leadId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (!lead) return;

  let score = 0;

  score += STATUS_SCORE[lead.status as string] ?? 0;
  score += SOURCE_SCORE[lead.source as string] ?? 0;

  if (lead.last_contacted_at) {
    const daysSinceContact = (Date.now() - new Date(lead.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceContact <= 7) score += 10;
    else if (daysSinceContact <= 30) score += 5;
  }

  const { data: completedTasks } = await supabase
    .from("lead_tasks")
    .select("id")
    .eq("lead_id", leadId)
    .not("completed_at", "is", null);

  score += (completedTasks?.length ?? 0) * 5;

  score = Math.min(100, score);

  await supabase
    .from("leads")
    .update({ lead_score: score, updated_at: new Date().toISOString() })
    .eq("id", leadId);
}

async function calculateLeadScoreForTaskCompletion(organizationId: string, leadId: string): Promise<void> {
  await calculateLeadScore(leadId);
}

export async function getConversionForecast(
  organizationId: string
): Promise<ConversionForecast> {
  await requireOrgFeatureAccess(organizationId, "advanced_crm_lead_pipeline");

  const supabase = await createSupabaseServerClient();
  const sinceDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);
  const gymIds = gyms?.map((g) => g.id) ?? [];

  let totalQuery;
  if (gymIds.length > 0) {
    totalQuery = supabase.from("leads").select("id", { count: "exact" }).in("gym_id", gymIds);
  } else {
    totalQuery = supabase.from("leads").select("id", { count: "exact" }).eq("organization_id", organizationId);
  }

  let convertedQuery;
  if (gymIds.length > 0) {
    convertedQuery = supabase.from("leads").select("id", { count: "exact" }).in("gym_id", gymIds).eq("status", "converted").gte("updated_at", sinceDate);
  } else {
    convertedQuery = supabase.from("leads").select("id", { count: "exact" }).eq("organization_id", organizationId).eq("status", "converted").gte("updated_at", sinceDate);
  }

  let recentEnquiriesQuery;
  if (gymIds.length > 0) {
    recentEnquiriesQuery = supabase.from("leads").select("id", { count: "exact" }).in("gym_id", gymIds).gte("created_at", sinceDate);
  } else {
    recentEnquiriesQuery = supabase.from("leads").select("id", { count: "exact" }).eq("organization_id", organizationId).gte("created_at", sinceDate);
  }

  let openLeadsQuery;
  if (gymIds.length > 0) {
    openLeadsQuery = supabase.from("leads").select("id", { count: "exact" }).in("gym_id", gymIds).not("status", "in", '("converted","lost")');
  } else {
    openLeadsQuery = supabase.from("leads").select("id", { count: "exact" }).eq("organization_id", organizationId).not("status", "in", '("converted","lost")');
  }

  const [totalRes, convertedRes, recentRes, openRes] = await Promise.all([
    totalQuery,
    convertedQuery,
    recentEnquiriesQuery,
    openLeadsQuery,
  ]);

  const totalLeads = totalRes.count ?? 0;
  const recentConversions = convertedRes.count ?? 0;
  const recentEnquiries = recentRes.count ?? 0;
  const openLeads = openRes.count ?? 0;

  const recentConversionRate = recentEnquiries > 0 ? recentConversions / recentEnquiries : 0;
  const estimatedConversions = Math.round(openLeads * recentConversionRate);
  const confidencePercent = totalLeads > 20 ? 85 : totalLeads > 5 ? 60 : 30;

  return { estimatedConversions, confidencePercent, basedOnPeriodDays: 90 };
}
