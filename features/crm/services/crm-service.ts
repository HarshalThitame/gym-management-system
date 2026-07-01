import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type CrmLeadRow = Database["public"]["Tables"]["crm_leads"]["Row"];
type CrmLeadStatusRow = Database["public"]["Tables"]["crm_lead_statuses"]["Row"];
type CrmLeadSourceRow = Database["public"]["Tables"]["crm_lead_sources"]["Row"];
type CrmFollowupRow = Database["public"]["Tables"]["crm_followups"]["Row"];

export type LeadWithRelations = CrmLeadRow & {
  status?: CrmLeadStatusRow | null;
  source?: CrmLeadSourceRow | null;
  followups?: CrmFollowupRow[];
};

export type CrmDashboard = {
  leads: LeadWithRelations[];
  statuses: CrmLeadStatusRow[];
  sources: CrmLeadSourceRow[];
  metrics: {
    totalLeads: number;
    activeLeads: number;
    convertedLeads: number;
    lostLeads: number;
    conversionRate: number;
  };
};

export async function getCrmDashboard(gymId: string | null): Promise<CrmDashboard> {
  const supabase = await createSupabaseServerClient();

  const [leadsResult, statusesResult, sourcesResult] = await Promise.all([
    supabase
      .from("crm_leads")
      .select(`
        *,
        status:crm_lead_statuses(*),
        source:crm_lead_sources(*),
        followups:crm_followups(*)
      `)
      .eq("gym_id", gymId ?? "")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("crm_lead_statuses")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("crm_lead_sources")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true })
  ]);

  const leads = (leadsResult.data ?? []) as LeadWithRelations[];
  const statuses = (statusesResult.data ?? []) as CrmLeadStatusRow[];
  const sources = (sourcesResult.data ?? []) as CrmLeadSourceRow[];

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l) => l.converted_at).length;
  const lostLeads = leads.filter((l) => l.lost_at).length;
  const activeLeads = totalLeads - convertedLeads - lostLeads;
  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

  return {
    leads,
    statuses,
    sources,
    metrics: {
      totalLeads,
      activeLeads,
      convertedLeads,
      lostLeads,
      conversionRate
    }
  };
}

export async function listLeads(gymId: string | null, options?: { statusId?: string; sourceId?: string; assignedTo?: string }) {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("crm_leads")
    .select(`
      *,
      status:crm_lead_statuses(*),
      source:crm_lead_sources(*)
    `)
    .eq("gym_id", gymId ?? "")
    .order("created_at", { ascending: false });

  if (options?.statusId) {
    query = query.eq("status_id", options.statusId);
  }
  if (options?.sourceId) {
    query = query.eq("source_id", options.sourceId);
  }
  if (options?.assignedTo) {
    query = query.eq("assigned_to", options.assignedTo);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []) as LeadWithRelations[];
}
