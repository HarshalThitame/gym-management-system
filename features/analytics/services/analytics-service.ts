import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type AnalyticsEventRow = Database["public"]["Tables"]["analytics_events"]["Row"];
export type AnalyticsFunnelRow = Database["public"]["Tables"]["analytics_funnels"]["Row"];
export type AnalyticsReportRow = Database["public"]["Tables"]["analytics_reports"]["Row"];

interface FunnelStepResult {
  step_name: string;
  event_type: string;
  count: number;
  conversion_rate: number;
}

export async function trackEvent(input: {
  organization_id: string;
  event_type: string;
  event_name: string;
  properties?: Record<string, unknown>;
  user_id?: string;
  session_id?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("analytics_events").insert(input);
  if (error) throw new Error(error.message);
}

export async function getEvents(organizationId: string, options: { event_type?: string; limit?: number; offset?: number }) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("analytics_events").select("*").eq("organization_id", organizationId);
  if (options.event_type) query = query.eq("event_type", options.event_type);
  query = query.order("timestamp", { ascending: false }).limit(options.limit ?? 100).range(options.offset ?? 0, (options.offset ?? 0) + 99);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEventStats(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("analytics_events")
    .select("event_type, event_name, count:event_type.count()")
    .eq("organization_id", organizationId)
    .order("count", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getFunnelConversion(organizationId: string, funnelSteps: { name: string; event_type: string; event_name: string }[]): Promise<FunnelStepResult[]> {
  const supabase = await createSupabaseServerClient();
  const results: FunnelStepResult[] = [];
  let previousCount = 0;

  for (const step of funnelSteps) {
    const { count, error } = await supabase
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_type", step.event_type)
      .eq("event_name", step.event_name);
    if (error) throw new Error(error.message);
    const currentCount = count ?? 0;
    results.push({
      step_name: step.name,
      event_type: step.event_type,
      count: currentCount,
      conversion_rate: previousCount > 0 ? (currentCount / previousCount) * 100 : 100,
    });
    previousCount = currentCount;
  }

  return results;
}

export async function getEventTimeline(organizationId: string, days: number = 30) {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("analytics_events")
    .select("event_name, timestamp")
    .eq("organization_id", organizationId)
    .gte("timestamp", since)
    .order("timestamp", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createFunnel(input: Database["public"]["Tables"]["analytics_funnels"]["Insert"]) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("analytics_funnels").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getFunnels(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("analytics_funnels").select("*").eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createReport(input: Database["public"]["Tables"]["analytics_reports"]["Insert"]) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("analytics_reports").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getReports(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("analytics_reports").select("*").eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getExecutiveAnalyticsDashboard(_gymId: string | null) {
  return {
    metrics: { totalRevenue: 0, totalMembers: 0, totalSessions: 0, averageRating: 0 },
    trends: { revenue: [], membership: [], sessions: [] },
    risks: [],
    insights: [],
  };
}

export async function getAnalyticsReportPayload(input: { gymId: string; reportKey: string }) {
  return {
    key: input.reportKey,
    category: "executive",
    rows: [] as Array<Record<string, unknown>>,
    generatedAt: new Date().toISOString(),
  };
}
