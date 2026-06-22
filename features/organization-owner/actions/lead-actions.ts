"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrgFeatureAccess } from "@/features/entitlement";
import type { LeadRow } from "@/features/organization-owner/services/lead-service";

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

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (notes !== undefined) update.notes = notes;

  const { data: updated, error } = await supabase
    .from("leads")
    .update(update as never)
    .eq("id", leadId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
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
