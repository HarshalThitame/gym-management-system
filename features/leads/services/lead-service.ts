import { addDays, formatISO } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyReceptionScopeFilters } from "@/features/reception/lib/operation-guards";
import type { LeadRow, LeadDashboard } from "@/types/lead";

type LeadScope = {
  branchId?: string | null;
  organizationId?: string | null;
};

export async function getLeadDashboard(gymId: string, scope: LeadScope = {}): Promise<LeadDashboard> {
  const supabase = await createSupabaseServerClient();
  const today = formatISO(new Date(), { representation: "date" });
  const tomorrow = formatISO(addDays(new Date(), 1), { representation: "date" });

  const [
    allLeadsResult,
    newLeadsResult,
    contactedResult,
    trialResult,
    convertedResult,
    lostResult,
    todayResult,
    recentResult,
    followUpsResult
  ] = await Promise.all([
    applyReceptionScopeFilters(supabase.from("leads").select("id", { count: "exact", head: true }), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null }),
    applyReceptionScopeFilters(supabase.from("leads").select("id", { count: "exact", head: true }), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null }).eq("status", "new"),
    applyReceptionScopeFilters(supabase.from("leads").select("id", { count: "exact", head: true }), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null }).eq("status", "contacted"),
    applyReceptionScopeFilters(supabase.from("leads").select("id", { count: "exact", head: true }), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null }).eq("status", "trial_active"),
    applyReceptionScopeFilters(supabase.from("leads").select("id", { count: "exact", head: true }), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null }).eq("status", "converted"),
    applyReceptionScopeFilters(supabase.from("leads").select("id", { count: "exact", head: true }), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null }).in("status", ["not_interested", "lost"]),
    applyReceptionScopeFilters(supabase.from("leads").select("id", { count: "exact", head: true }), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null }).gte("created_at", `${today}T00:00:00.000Z`).lte("created_at", `${tomorrow}T00:00:00.000Z`),
    applyReceptionScopeFilters(supabase.from("leads").select("*"), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null }).order("created_at", { ascending: false }).limit(10),
    applyReceptionScopeFilters(supabase.from("leads").select("*"), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null }).in("status", ["new", "contacted", "visit_scheduled"]).order("created_at", { ascending: false }).limit(15)
  ]);

  const firstError = [
    allLeadsResult, newLeadsResult, contactedResult, trialResult,
    convertedResult, lostResult, todayResult, recentResult, followUpsResult
  ].find((r) => r.error)?.error;

  if (firstError) throw new Error(firstError.message);

  return {
    metrics: {
      totalLeads: allLeadsResult.count ?? 0,
      newLeads: newLeadsResult.count ?? 0,
      contactedLeads: contactedResult.count ?? 0,
      trialActive: trialResult.count ?? 0,
      convertedLeads: convertedResult.count ?? 0,
      lostLeads: lostResult.count ?? 0,
      todayLeads: todayResult.count ?? 0
    },
    recentLeads: (recentResult.data ?? []) as LeadRow[],
    followUps: (followUpsResult.data ?? []) as LeadRow[]
  };
}

export async function listLeads(input: {
  gymId: string;
  branchId?: string | null;
  organizationId?: string | null;
  page?: number;
  pageSize?: number;
  status?: string;
  source?: string;
  query?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 5), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  query = applyReceptionScopeFilters(query, {
    gymId: input.gymId,
    branchId: input.branchId ?? null,
    scopedOrganizationId: input.organizationId ?? null,
    organizationId: input.organizationId ?? null,
  });

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status);
  }

  if (input.source && input.source !== "all") {
    query = query.eq("source", input.source);
  }

  if (input.query) {
    const escaped = input.query.replace(/[%_,]/g, "");
    query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { leads: (data ?? []) as LeadRow[], total: count ?? 0, page, pageSize };
}

export async function getLeadById(leadId: string, gymId: string, scope: LeadScope = {}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await applyReceptionScopeFilters(supabase
    .from("leads")
    .select("*")
    .eq("id", leadId), { gymId, branchId: scope.branchId ?? null, scopedOrganizationId: scope.organizationId ?? null, organizationId: scope.organizationId ?? null })
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as LeadRow | null;
}
