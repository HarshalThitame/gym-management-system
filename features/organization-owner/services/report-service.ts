import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireFeatureAccess } from "@/features/entitlement";

export type TrainerPerformance = {
  trainerId: string;
  trainerName: string;
  totalSessions: number;
  ptSessions: number;
  classSessions: number;
  avgRating: number;
  totalAttendees: number;
};

export type ClassOccupancy = {
  classType: string;
  totalSlots: number;
  totalBooked: number;
  occupancyPercent: number;
  avgAttendees: number;
  sessionCount: number;
};

export type LeadFunnelStage = {
  stage: string;
  count: number;
  conversionFromPrevious: number | null;
};

export type LeadSourceBreakdown = {
  source: string;
  total: number;
  won: number;
  conversionRate: number;
};

export type BranchRevenueComparison = {
  branchId: string;
  branchName: string;
  totalRevenue: number;
  memberCount: number;
  attendanceCount: number;
  revenuePerMember: number;
};

export type BranchRevenueTimeSeries = {
  date: string;
  revenue: number;
  branchName: string;
};

export async function getTrainerPerformanceReport(
  organizationId: string,
  dateFrom: string,
  dateTo: string,
): Promise<{ trainers: TrainerPerformance[]; monthlyTrend: { month: string; totalSessions: number; totalAttendees: number }[] }> {
  await requireFeatureAccess(organizationId, "trainer_performance_report");

  const supabase = await createSupabaseServerClient();

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);
  const gymIds = gyms?.map((g) => g.id) ?? [];
  if (gymIds.length === 0) return { trainers: [], monthlyTrend: [] };

  const { data: trainers } = await supabase
    .from("trainers")
    .select("id, display_name")
    .in("gym_id", gymIds)
    .neq("status", "archived");
  if (!trainers?.length) return { trainers: [], monthlyTrend: [] };

  const trainerIds = trainers.map((t) => t.id);

  // Class sessions taught by trainer
  const { data: classSessions } = await supabase
    .from("class_sessions")
    .select("id, primary_trainer_id, booked_count, session_date")
    .in("primary_trainer_id", trainerIds)
    .gte("session_date", dateFrom)
    .lte("session_date", dateTo)
    .in("status", ["completed", "in_progress"]);

  // PT assignments (personal training sessions)
  const { data: ptAssignments } = await supabase
    .from("trainer_assignments")
    .select("id, trainer_id, assigned_at")
    .in("trainer_id", trainerIds)
    .eq("assignment_type", "personal_training")
    .gte("assigned_at", dateFrom)
    .lte("assigned_at", dateTo);

  const trainerAgg = new Map<string, { classCount: number; ptCount: number; attendees: number }>();
  for (const t of trainers) {
    trainerAgg.set(t.id, { classCount: 0, ptCount: 0, attendees: 0 });
  }

  const monthlyAgg = new Map<string, { sessions: number; attendees: number }>();

  for (const cs of classSessions ?? []) {
    if (!cs.primary_trainer_id) continue;
    const entry = trainerAgg.get(cs.primary_trainer_id);
    if (entry) {
      entry.classCount++;
      entry.attendees += Number(cs.booked_count ?? 0);
    }
    const month = cs.session_date.slice(0, 7);
    const m = monthlyAgg.get(month) ?? { sessions: 0, attendees: 0 };
    m.sessions++;
    m.attendees += Number(cs.booked_count ?? 0);
    monthlyAgg.set(month, m);
  }

  for (const a of ptAssignments ?? []) {
    const entry = trainerAgg.get(a.trainer_id);
    if (entry) entry.ptCount++;
    const month = a.assigned_at.slice(0, 7);
    const m = monthlyAgg.get(month) ?? { sessions: 0, attendees: 0 };
    m.sessions++;
    monthlyAgg.set(month, m);
  }

  // Aggregate trainer ratings
  const ratingMap = new Map<string, number>();
  try {
    const { data: ratings, error: ratingError } = await supabase
      .from("trainer_ratings")
      .select("trainer_id, rating")
      .in("trainer_id", trainerIds);
    if (!ratingError && ratings) {
      const ratingSums = new Map<string, { sum: number; count: number }>();
      for (const r of ratings) {
        if (!r.trainer_id || r.rating == null) continue;
        const e = ratingSums.get(r.trainer_id) ?? { sum: 0, count: 0 };
        e.sum += Number(r.rating);
        e.count++;
        ratingSums.set(r.trainer_id, e);
      }
      for (const [tid, { sum, count }] of ratingSums) {
        ratingMap.set(tid, Math.round((sum / count) * 10) / 10);
      }
    }
  } catch {
    // trainer_ratings table not yet migrated — skip
  }

  const trainerList: TrainerPerformance[] = trainers.map((t) => {
    const entry = trainerAgg.get(t.id) ?? { classCount: 0, ptCount: 0, attendees: 0 };
    return {
      trainerId: t.id,
      trainerName: t.display_name,
      totalSessions: entry.classCount + entry.ptCount,
      ptSessions: entry.ptCount,
      classSessions: entry.classCount,
      avgRating: ratingMap.get(t.id) ?? 0,
      totalAttendees: entry.attendees,
    };
  });

  const monthlyTrend = Array.from(monthlyAgg.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, agg]) => ({ month, totalSessions: agg.sessions, totalAttendees: agg.attendees }));

  return { trainers: trainerList, monthlyTrend };
}

export async function getClassOccupancyReport(
  organizationId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ClassOccupancy[]> {
  await requireFeatureAccess(organizationId, "class_occupancy_report");

  const supabase = await createSupabaseServerClient();

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);
  const gymIds = gyms?.map((g) => g.id) ?? [];
  if (gymIds.length === 0) return [];

  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("id, class_id, capacity, booked_count")
    .in("gym_id", gymIds)
    .gte("session_date", dateFrom)
    .lte("session_date", dateTo);

  if (!sessions?.length) return [];

  // Also get class names by joining with classes table
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, class_type")
    .in("gym_id", gymIds);

  const classMap = new Map(classes?.map((c) => [c.id, { name: c.name, type: c.class_type }]) ?? []);

  const classTypeAgg = new Map<string, { slots: number; booked: number; sessions: number; attendees: number }>();
  for (const s of sessions) {
    const cls = classMap.get(s.class_id);
    const type = cls?.type ?? cls?.name ?? "General";
    const agg = classTypeAgg.get(type) ?? { slots: 0, booked: 0, sessions: 0, attendees: 0 };
    agg.slots += Number(s.capacity ?? 0);
    agg.booked += Number(s.booked_count ?? 0);
    agg.sessions++;
    agg.attendees += Number(s.booked_count ?? 0);
    classTypeAgg.set(type, agg);
  }

  return Array.from(classTypeAgg.entries())
    .map(([classType, agg]) => ({
      classType,
      totalSlots: agg.slots,
      totalBooked: agg.booked,
      occupancyPercent: agg.slots > 0 ? Math.round((agg.booked / agg.slots) * 1000) / 10 : 0,
      avgAttendees: agg.sessions > 0 ? Math.round((agg.attendees / agg.sessions) * 10) / 10 : 0,
      sessionCount: agg.sessions,
    }))
    .sort((a, b) => b.occupancyPercent - a.occupancyPercent);
}

export async function getLeadConversionReport(
  organizationId: string,
  dateFrom: string,
  dateTo: string,
): Promise<{ funnel: LeadFunnelStage[]; sourceBreakdown: LeadSourceBreakdown[]; totalLeads: number; conversionRate: number; avgDaysToConvert: number | null }> {
  await requireFeatureAccess(organizationId, "lead_conversion_report");

  const supabase = await createSupabaseServerClient();

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);
  const gymIds = gyms?.map((g) => g.id) ?? [];

  let query = supabase
    .from("leads")
    .select("id, status, source, created_at, updated_at")
    .gte("created_at", dateFrom)
    .lte("created_at", dateTo);

  if (gymIds.length > 0) {
    query = query.in("gym_id", gymIds);
  } else {
    return { funnel: [], sourceBreakdown: [], totalLeads: 0, conversionRate: 0, avgDaysToConvert: null };
  }

  const { data: leads } = await query;
  if (!leads?.length) {
    return { funnel: [], sourceBreakdown: [], totalLeads: 0, conversionRate: 0, avgDaysToConvert: null };
  }

  // Status mapping to funnel stages
  const funnelOrder = ["new", "contacted", "trial_scheduled", "trial_completed", "converted", "lost"];
  const funnelLabel: Record<string, string> = {
    "new": "New",
    "contacted": "Contacted",
    "trial_scheduled": "Trial Scheduled",
    "trial_completed": "Trial Attended",
    "converted": "Won",
    "lost": "Lost",
  };

  const statusCounts = new Map<string, number>();
  for (const l of leads) {
    const status = l.status?.toLowerCase() ?? "new";
    const mapped = funnelLabel[status] ? status : "new";
    statusCounts.set(mapped, (statusCounts.get(mapped) ?? 0) + 1);
  }

  const funnel = funnelOrder
    .filter((s) => statusCounts.has(s))
    .map((stage, i) => {
      const count = statusCounts.get(stage) ?? 0;
      let conversionFromPrevious: number | null = null;
      if (i > 0) {
        const prevStage = funnelOrder[i - 1]!;
        const prevCount = statusCounts.get(prevStage) ?? 0;
        conversionFromPrevious = prevCount > 0 ? Math.round((count / prevCount) * 1000) / 10 : null;
      }
      return { stage: funnelLabel[stage] ?? stage, count, conversionFromPrevious };
    });

  // Source breakdown
  const sourceAgg = new Map<string, { total: number; converted: number }>();
  for (const l of leads) {
    const source = l.source ?? "unknown";
    const agg = sourceAgg.get(source) ?? { total: 0, converted: 0 };
    agg.total++;
    if (l.status === "converted") agg.converted++;
    sourceAgg.set(source, agg);
  }

  const sourceBreakdown = Array.from(sourceAgg.entries())
    .map(([source, agg]) => ({
      source,
      total: agg.total,
      won: agg.converted,
      conversionRate: agg.total > 0 ? Math.round((agg.converted / agg.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l) => l.status === "converted").length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0;

  // Average days to convert for converted leads
  const convertedWithDates = leads.filter((l) => l.status === "converted" && l.created_at && l.updated_at);
  const avgDaysToConvert = convertedWithDates.length > 0
    ? Math.round((convertedWithDates.reduce((sum, l) => sum + ((new Date(l.updated_at!).getTime() - new Date(l.created_at!).getTime()) / (1000 * 60 * 60 * 24)), 0) / convertedWithDates.length) * 10) / 10
    : null;

  return { funnel, sourceBreakdown, totalLeads, conversionRate, avgDaysToConvert };
}

export async function getBranchRevenueComparison(
  organizationId: string,
  dateFrom: string,
  dateTo: string,
): Promise<{ branches: BranchRevenueComparison[]; timeSeries: BranchRevenueTimeSeries[] }> {
  await requireFeatureAccess(organizationId, "branch_revenue_comparison");

  const supabase = await createSupabaseServerClient();

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("organization_id", organizationId);
  if (!branches?.length) return { branches: [], timeSeries: [] };

  const branchIds = branches.map((b) => b.id);
  const branchNameMap = new Map(branches.map((b) => [b.id, b.name]));

  const { data: metrics } = await supabase
    .from("branch_metrics")
    .select("branch_id, metric_date, revenue_amount, active_members, attendance_count")
    .in("branch_id", branchIds)
    .gte("metric_date", dateFrom)
    .lte("metric_date", dateTo)
    .order("metric_date", { ascending: true });

  const branchAgg = new Map<string, { revenue: number; memberSum: number; attendance: number; count: number }>();
  for (const b of branches) {
    branchAgg.set(b.id, { revenue: 0, memberSum: 0, attendance: 0, count: 0 });
  }

  for (const m of metrics ?? []) {
    const agg = branchAgg.get(m.branch_id);
    if (!agg) continue;
    agg.revenue += Number(m.revenue_amount ?? 0);
    agg.memberSum += Number(m.active_members ?? 0);
    agg.attendance += Number(m.attendance_count ?? 0);
    agg.count++;
  }

  const branchComparisons: BranchRevenueComparison[] = Array.from(branchAgg.entries())
    .filter(([, agg]) => agg.revenue > 0 || agg.attendance > 0)
    .map(([branchId, agg]) => ({
      branchId,
      branchName: branchNameMap.get(branchId) ?? "Unknown",
      totalRevenue: Math.round(agg.revenue * 100) / 100,
      memberCount: agg.count > 0 ? Math.round((agg.memberSum / agg.count) * 10) / 10 : 0,
      attendanceCount: agg.attendance,
      revenuePerMember: agg.memberSum > 0 ? Math.round((agg.revenue / (agg.memberSum / agg.count)) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const timeSeries: BranchRevenueTimeSeries[] = (metrics ?? []).map((m) => ({
    date: m.metric_date,
    revenue: Number(m.revenue_amount ?? 0),
    branchName: branchNameMap.get(m.branch_id) ?? "Unknown",
  }));

  return { branches: branchComparisons, timeSeries };
}
