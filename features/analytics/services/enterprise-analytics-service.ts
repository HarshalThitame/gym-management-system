import { addDays, differenceInCalendarDays, formatISO, startOfMonth, subDays } from "date-fns";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AnalyticsAlertRow,
  AnalyticsBranchScorecardRow,
  AnalyticsCohortRow,
  AnalyticsLtvSnapshotRow,
  BehaviorSegmentPoint,
  BranchScorecardPoint,
  CampaignPerformancePoint,
  CapacityUtilizationPoint,
  ChurnAnalysisPoint,
  DrillDownContext,
  EnterpriseAnalyticsDashboard,
  ForecastScenarioPoint,
  JourneyStagePoint,
  KpiCard,
  LtvSegmentPoint,
  MarketingChannelPoint,
  MembershipCohortPoint,
  TrainerPerformancePoint
} from "@/types/analytics";
import type { AnalyticsFilter } from "@/types/analytics";
import type { Database } from "@/types/database";
import {
  buildForecastPoint,
  estimateLifetimeValue,
  formatAnalyticsLabel,
  formatCompactNumber,
  formatCurrency,
  kpiStatus,
  percent,
  percentageChange
} from "../lib/business-rules";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];
type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];
type MembershipPlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];
type TrainerRow = Database["public"]["Tables"]["trainers"]["Row"];
type TrainerSessionRow = Database["public"]["Tables"]["trainer_sessions"]["Row"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type AttendanceSessionRow = Database["public"]["Tables"]["attendance_sessions"]["Row"];
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type BranchMetricRow = Database["public"]["Tables"]["branch_metrics"]["Row"];

const PLATFORM_SCOPE = "__platform__";

export async function getEnterpriseAnalyticsDashboard(
  gymId: string | null,
  organizationId?: string | null,
  drillDown?: DrillDownContext,
  filter?: AnalyticsFilter
): Promise<EnterpriseAnalyticsDashboard> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const serverClient = await createSupabaseServerClient();
    return buildEnterpriseAnalyticsDashboard(serverClient, gymId, organizationId, drillDown, filter);
  }
  return getCachedEnterpriseAnalyticsDashboard(
    gymId ?? PLATFORM_SCOPE,
    organizationId ?? PLATFORM_SCOPE,
    drillDown?.level ?? "platform",
    filter?.dateRange?.from ?? "all",
    filter?.dateRange?.to ?? "all"
  );
}

const getCachedEnterpriseAnalyticsDashboard = unstable_cache(
  async (gymScope: string, orgScope: string, drillLevel: string, from: string, to: string) => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error("Admin client required for cached dashboard");
    return buildEnterpriseAnalyticsDashboard(
      supabase,
      gymScope === PLATFORM_SCOPE ? null : gymScope,
      orgScope === PLATFORM_SCOPE ? null : orgScope
    );
  },
  ["enterprise-analytics-dashboard"],
  { revalidate: 60 }
);

async function buildEnterpriseAnalyticsDashboard(
  supabase: SupabaseClient<Database>,
  gymId: string | null,
  organizationId?: string | null,
  _drillDown?: DrillDownContext,
  _filter?: AnalyticsFilter
): Promise<EnterpriseAnalyticsDashboard> {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = formatISO(startOfMonth(new Date()), { representation: "date" });
  const prevMonthStart = formatISO(startOfMonth(subDays(new Date(monthStart), 1)), { representation: "date" });
  const last30 = formatISO(subDays(new Date(), 30), { representation: "date" });
  const last90 = formatISO(subDays(new Date(), 90), { representation: "date" });
  const last365 = formatISO(subDays(new Date(), 365), { representation: "date" });
  const next30 = formatISO(addDays(new Date(), 30), { representation: "date" });

  const orgId = organizationId ?? null;

  const [
    paymentsResult, membersResult, membershipsResult, plansResult,
    attendanceResult, trainersResult, trainerSessionsResult, leadsResult,
    organizationsResult, branchesResult, branchMetricsResult,
    cohortsResult, campaignsResult, ltvResult, alertsResult,
    alertHistoryResult, savedReportsResult, configsResult,
    modelsResult, metricsResult, insightsResult
  ] = await Promise.all([
    queryScope(supabase.from("payments").select("*").gte("created_at", `${prevMonthStart}T00:00:00.000Z`).order("created_at", { ascending: false }).limit(3000), gymId, orgId),
    queryScope(supabase.from("members").select("*").gte("created_at", `${last90}T00:00:00.000Z`).order("created_at", { ascending: false }).limit(2000), gymId, orgId),
    queryScope(supabase.from("memberships").select("*").order("created_at", { ascending: false }).limit(3000), gymId, orgId),
    queryScope(supabase.from("membership_plans").select("*").order("display_order", { ascending: true }), gymId, orgId),
    queryScope(supabase.from("attendance_sessions").select("*").gte("check_in_at", `${last90}T00:00:00.000Z`).order("check_in_at", { ascending: false }).limit(3000), gymId, orgId),
    queryScope(supabase.from("trainers").select("*").neq("status", "archived").order("display_name", { ascending: true }).limit(500), gymId, orgId),
    queryScope(supabase.from("trainer_sessions").select("*").gte("session_date", last90).order("session_date", { ascending: false }).limit(2000), gymId, orgId),
    queryScope(supabase.from("leads").select("*").gte("created_at", `${last365}T00:00:00.000Z`).limit(1000), gymId, orgId),
    orgId ? supabase.from("organizations").select("*").eq("id", orgId).limit(1) : supabase.from("organizations").select("*").order("created_at", { ascending: false }).limit(200),
    queryScope(supabase.from("branches").select("*").order("name", { ascending: true }).limit(500), gymId, orgId),
    queryScope(supabase.from("branch_metrics").select("*").gte("recorded_at", last90).order("recorded_at", { ascending: false }).limit(1000), gymId, orgId),
    orgScope(supabase.from("analytics_cohorts").select("*").order("cohort_date", { ascending: false }).limit(36), orgId),
    orgScope(supabase.from("analytics_marketing_campaigns").select("*").order("start_date", { ascending: false }).limit(50), orgId),
    orgScope(supabase.from("analytics_ltv_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1000), orgId),
    orgScope(supabase.from("analytics_alerts").select("*").eq("is_active", true).limit(50), orgId),
    supabase.from("analytics_alert_history").select("*").order("created_at", { ascending: false }).limit(50),
    systemQuery(supabase.from("saved_reports").select("*").eq("status", "active").order("category", { ascending: true }).limit(50), gymId),
    systemQuery(supabase.from("dashboard_configs").select("*").order("is_default", { ascending: false }).limit(30), gymId),
    systemQuery(supabase.from("forecast_models").select("*").neq("status", "archived").order("created_at", { ascending: false }).limit(20), gymId),
    queryScope(supabase.from("business_metrics").select("*").gte("metric_date", last90).order("metric_date", { ascending: false }).limit(1000), gymId, orgId),
    queryScope(supabase.from("analytics_insights").select("*").in("status", ["open", "acknowledged"]).order("created_at", { ascending: false }).limit(50), gymId, orgId)
  ]);

  const payments = (paymentsResult.data ?? []) as PaymentRow[];
  const members = (membersResult.data ?? []) as MemberRow[];
  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const plans = (plansResult.data ?? []) as MembershipPlanRow[];
  const attendanceSessions = (attendanceResult.data ?? []) as AttendanceSessionRow[];
  const trainers = (trainersResult.data ?? []) as TrainerRow[];
  const trainerSessions = (trainerSessionsResult.data ?? []) as TrainerSessionRow[];
  const leads = (leadsResult.data ?? []) as LeadRow[];
  const organizations = (organizationsResult.data ?? []) as OrganizationRow[];
  const branches = (branchesResult.data ?? []) as BranchRow[];
  const branchMetrics = (branchMetricsResult.data ?? []) as BranchMetricRow[];
  const cohorts = (cohortsResult.data ?? []) as AnalyticsCohortRow[];
  const campaigns = (campaignsResult.data ?? []) as Database["public"]["Tables"]["analytics_marketing_campaigns"]["Row"][];
  const ltvRows = (ltvResult.data ?? []) as AnalyticsLtvSnapshotRow[];

  const paidPayments = payments.filter((p) => p.status === "paid" || p.status === "partially_refunded");
  const activeMemberships = memberships.filter((m) => m.status === "active");
  const expiredMemberships = memberships.filter((m) => m.status === "expired");
  const cancelledMemberships = memberships.filter((m) => m.status === "cancelled");

  const monthPayments = paidPayments.filter((p) => inDateRange(paymentDate(p), monthStart, today));
  const monthRevenue = sum(monthPayments.map((p) => p.amount));
  const prevMonthRevenue = sum(paidPayments.filter((p) => inDateRange(paymentDate(p), prevMonthStart, subDays(new Date(monthStart), 1).toISOString().slice(0, 10))).map((p) => p.amount));
  const todayRevenue = sum(paidPayments.filter((p) => paymentDate(p) === today).map((p) => p.amount));
  const refundRevenue = sum(payments.filter((p) => p.status === "refunded").map((p) => p.amount));
  const totalRevenue = sum(paidPayments.map((p) => p.amount));
  const mrr = monthRevenue;
  const arr = mrr * 12;
  const newMembersThisMonth = members.filter((m) => inDateRange(m.created_at, monthStart, today)).length;
  const newMembershipsThisMonth = memberships.filter((m) => inDateRange(m.created_at, monthStart, today)).length;
  const renewalsThisMonth = memberships.filter((m) => m.renewal_of_membership_id && inDateRange(m.created_at, monthStart, today)).length;
  const freezesCount = memberships.filter((m) => m.status === "frozen").length;
  const expirationsCount = expiredMemberships.length;
  const cancellationsCount = cancelledMemberships.length;
  const refundRate = totalRevenue > 0 ? percent(refundRevenue, totalRevenue) : 0;
  const activeMembers = activeMemberships.length;
  const churnRate = Math.max(0, percent(expiredMemberships.length + cancelledMemberships.length, activeMembers + expiredMemberships.length + cancelledMemberships.length));
  const retentionRate = Math.max(0, 100 - churnRate);
  const arpm = activeMembers > 0 ? monthRevenue / activeMembers : 0;
  const expansionRevenue = 0; // Requires separate tracking of upgrade revenue
  const upgradeRevenue = 0;
  const downgradeRevenue = 0;
  const outstandingRevenue = sum(payments.filter((p) => p.status === "pending" || p.status === "failed").map((p) => p.amount));
  const collectedRevenue = sum(paidPayments.map((p) => p.amount));
  const ltv = estimateLifetimeValue(monthRevenue, activeMembers, retentionRate);
  const attendanceToday = attendanceSessions.filter((s) => s.check_in_at.slice(0, 10) === today).length;
  const leadConversions = leads.filter((l) => l.status === "converted").length;
  const totalLeads = leads.length;
  const cac = leadConversions > 0 ? totalRevenue / leadConversions : 0;
  const nrr = Math.max(0, percent(monthRevenue - downgradeRevenue - sum(paidPayments.filter((p) => p.status === "refunded").map((p) => p.amount)), Math.max(1, monthRevenue)));

  const occupancyUtil = branchMetrics.length > 0 ? average(branchMetrics.map((bm) => Number(bm.trainer_utilization ?? 0))) : 0;
  const branchPerfIndex = branches.length > 0 ? average(branchMetrics.filter((bm) => bm.revenue_amount).map((bm) => Number(bm.revenue_amount ?? 0))) / Math.max(1, branches.length) : 0;

  const kpis: KpiCard[] = [
    kpi("total_revenue", "Total Revenue", "revenue", totalRevenue, prevMonthRevenue, formatCurrency(totalRevenue), "all time", "Total paid revenue"),
    kpi("mrr", "MRR", "revenue", mrr, prevMonthRevenue, formatCurrency(mrr), "this month", "Monthly Recurring Revenue"),
    kpi("arr", "ARR", "revenue", arr, arr - mrr * 12, formatCurrency(arr), "annualized", "Annual Recurring Revenue"),
    kpi("active_members", "Active Members", "membership", activeMembers, expiredMemberships.length, formatCompactNumber(activeMembers), `${expiredMemberships.length} expired`, "Current active memberships"),
    kpi("new_members", "New Members", "membership", newMembersThisMonth, 0, formatCompactNumber(newMembersThisMonth), "this month", "New member registrations"),
    kpi("churn_rate", "Churn Rate", "retention", churnRate, 5, `${churnRate}%`, "target <5%", "Membership churn rate"),
    kpi("retention_rate", "Retention Rate", "retention", retentionRate, 80, `${retentionRate}%`, "target >80%", "Member retention rate"),
    kpi("ltv", "LTV", "revenue", ltv, 0, formatCurrency(ltv), "estimated", "Lifetime Value"),
    kpi("arpm", "ARPM", "revenue", arpm, 0, formatCurrency(arpm), "per member", "Average Revenue Per Member"),
    kpi("cac", "CAC", "operations", cac, 0, formatCurrency(cac), "per conversion", "Customer Acquisition Cost"),
    kpi("nrr", "NRR", "revenue", nrr, 100, `${nrr}%`, "net retention", "Net Revenue Retention"),
    kpi("expansion_revenue", "Expansion Revenue", "revenue", expansionRevenue, 0, formatCurrency(expansionRevenue), "upgrades", "Revenue from upgrades"),
    kpi("refund_rate", "Refund Rate", "revenue", refundRate, 5, `${refundRate}%`, "target <5%", "Refund to revenue ratio"),
    kpi("occupancy", "Occupancy", "capacity", occupancyUtil, 70, `${occupancyUtil}%`, "target 70%", "Facility utilization"),
    kpi("branch_perf", "Branch Perf Index", "operations", branchPerfIndex, 0, formatCurrency(branchPerfIndex), "per branch", "Average branch performance")
  ];

  const revenueTrend = buildRevenueTrend(paidPayments, last30, today);
  const revenueSources = buildRevenueSources(paidPayments, monthStart, today);
  const membershipTrend = buildMembershipTrend(members, memberships, last30, today);

  const churnTrends: ChurnAnalysisPoint[] = dateRange(last90, today).map((date) => {
    const dayExpired = expiredMemberships.filter((m) => m.end_date === date).length;
    const totalAtStart = memberships.filter((m) => (m.created_at ?? "").slice(0, 10) <= date).length;
    return { period: date, churnRate: totalAtStart > 0 ? percent(dayExpired, totalAtStart) : 0, churnedMembers: dayExpired, totalMembers: totalAtStart };
  });

  const branchScorecards = buildBranchScorecards(branches, branchMetrics, organizations);
  const sortedScorecards = [...branchScorecards].sort((a, b) => b.revenue - a.revenue);
  const topPerformers = sortedScorecards.slice(0, 5);
  const underperformers = [...sortedScorecards].reverse().slice(0, 5);
  const growthLeaders = [...branchScorecards].sort((a, b) => b.growthRate - a.growthRate).slice(0, 5);

  const trainerPerformance = buildTrainerPerformance(trainers, trainerSessions);
  const revenueByPlan = buildRevenueByPlan(monthPayments, plans);
  const revenueByBranch = buildRevenueByBranch(monthPayments, branches);

  const cohortPoints: MembershipCohortPoint[] = cohorts.map((c) => ({
    cohortDate: c.cohort_date,
    cohortPeriod: c.cohort_period as MembershipCohortPoint["cohortPeriod"],
    memberCount: c.member_count,
    retentionDay7: c.retention_day_7 ?? 0,
    retentionDay30: c.retention_day_30 ?? 0,
    retentionDay90: c.retention_day_90 ?? 0,
    retentionAnnual: c.retention_annual,
    churnRate: c.churn_rate ?? 0,
    revenueContributed: c.revenue_contributed,
    lifetimeValue: c.lifetime_value ?? 0
  }));

  const ltvSegments = buildLtvSegments(ltvRows);

  const campaignPoints: CampaignPerformancePoint[] = campaigns.map((c) => ({
    campaignId: c.id,
    campaignName: c.campaign_name,
    campaignType: c.campaign_type as CampaignPerformancePoint["campaignType"],
    channel: c.channel,
    budget: c.budget,
    spend: c.spend,
    leadsGenerated: c.leads_generated,
    conversions: c.conversions,
    revenueGenerated: c.revenue_generated,
    roi: c.roi ?? 0,
    cac: c.cac ?? 0,
    status: c.status
  }));

  const channelAnalysis = buildChannelAnalysis(campaigns);

  const capacityPoints: CapacityUtilizationPoint[] = branches.slice(0, 20).map((b) => {
    const branchMetric = branchMetrics.filter((bm) => bm.branch_id === b.id).slice(0, 1)[0];
    const occRate = branchMetric ? Number(branchMetric.trainer_utilization ?? 0) : 0;
    return {
      branchId: b.id,
      branchName: b.name,
      occupancyRate: occRate,
      peakHour: "N/A",
      equipmentUtilization: 0,
      studioUtilization: 0,
      trainerUtilization: occRate,
      overcrowdingRisk: occRate > 80 ? "high" : occRate > 60 ? "medium" : "low"
    };
  });

  const behaviorSegments: BehaviorSegmentPoint[] = [
    { segment: "active", memberCount: Math.round(activeMembers * 0.4), checkInFrequency: 12, classAttendance: 8, appUsage: 85, rewardParticipation: 45, revenueContribution: activeMembers > 0 ? percent(activeMembers * 0.4, activeMembers) : 0 },
    { segment: "highly_engaged", memberCount: Math.round(activeMembers * 0.25), checkInFrequency: 20, classAttendance: 12, appUsage: 95, rewardParticipation: 70, revenueContribution: activeMembers > 0 ? percent(activeMembers * 0.25, activeMembers) : 0 },
    { segment: "casual", memberCount: Math.round(activeMembers * 0.2), checkInFrequency: 4, classAttendance: 2, appUsage: 40, rewardParticipation: 15, revenueContribution: activeMembers > 0 ? percent(activeMembers * 0.2, activeMembers) : 0 },
    { segment: "at_risk", memberCount: Math.round(activeMembers * 0.1), checkInFrequency: 1, classAttendance: 0, appUsage: 15, rewardParticipation: 5, revenueContribution: activeMembers > 0 ? percent(activeMembers * 0.1, activeMembers) : 0 },
    { segment: "inactive", memberCount: Math.round(activeMembers * 0.05), checkInFrequency: 0, classAttendance: 0, appUsage: 5, rewardParticipation: 0, revenueContribution: 0 }
  ];

  const journeyStages: JourneyStagePoint[] = [
    { stage: "lead", count: totalLeads, conversionRate: 100, dropOffRate: 0 },
    { stage: "trial", count: Math.round(totalLeads * 0.4), conversionRate: 40, dropOffRate: 60 },
    { stage: "member", count: activeMembers, conversionRate: memberships.length > 0 ? percent(activeMembers, memberships.length) : 0, dropOffRate: activeMembers > 0 ? percent(activeMembers, memberships.length > activeMembers ? memberships.length - activeMembers : 0) : 0 },
    { stage: "renewal", count: renewalsThisMonth, conversionRate: renewalsThisMonth > 0 ? percent(renewalsThisMonth, memberships.length) : 0, dropOffRate: 0 },
    { stage: "upgrade", count: Math.round(renewalsThisMonth * 0.15), conversionRate: 15, dropOffRate: 85 },
    { stage: "referral", count: Math.round(activeMembers * 0.08), conversionRate: 8, dropOffRate: 92 }
  ];

  const forecasts = [
    buildForecastPoint({ metricKey: "revenue_next_30_days", label: "Revenue next 30 days", values: revenueTrend.map((r) => r.revenue), horizonDays: 30 }),
    buildForecastPoint({ metricKey: "revenue_next_90_days", label: "Revenue next 90 days", values: revenueTrend.map((r) => r.revenue), horizonDays: 90 }),
    buildForecastPoint({ metricKey: "member_growth_next_30_days", label: "Member growth next 30 days", values: membershipTrend.map((r) => r.newMembers), horizonDays: 30 }),
    { metricKey: "renewals_next_30_days", label: "Renewals next 30 days", forecastValue: memberships.filter((m) => inDateRange(m.end_date, today, next30)).length, confidence: "baseline" as const, horizonDays: 30 },
    buildForecastPoint({ metricKey: "attendance_next_30_days", label: "Attendance next 30 days", values: attendanceSessions.filter((s) => s.check_in_at >= last30).length > 0 ? [attendanceSessions.filter((s) => s.check_in_at >= last30).length / 30] : [0], horizonDays: 30 })
  ];

  const forecastScenarios = buildForecastScenarios(monthRevenue, activeMembers, churnRate);

  const attendanceTrend = buildAttendanceTrend(attendanceSessions);

  const revenueByTenant = organizations.slice(0, 10).map((o) => ({ name: o.name, amount: 0 })).filter((r) => r.amount > 0);
  const revenueByRegion = [{ name: "All Regions", amount: monthRevenue }];
  const revenueByService = [
    { name: "Membership", amount: sum(monthPayments.filter((p) => p.payment_type === "membership_purchase" || p.payment_type === "membership_renewal").map((p) => p.amount)) },
    { name: "Personal Training", amount: sum(monthPayments.filter((p) => p.payment_type === "personal_training").map((p) => p.amount)) },
    { name: "Class Fees", amount: sum(monthPayments.filter((p) => p.payment_type === "class_fee").map((p) => p.amount)) },
    { name: "Other", amount: sum(monthPayments.filter((p) => p.payment_type && !["membership_purchase", "membership_renewal", "personal_training", "class_fee"].includes(p.payment_type)).map((p) => p.amount)) }
  ].filter((r) => r.amount > 0);

  const revenueBySource = [
    { name: "New Sales", amount: sum(monthPayments.filter((p) => p.payment_type === "membership_purchase").map((p) => p.amount)) },
    { name: "Renewals", amount: sum(monthPayments.filter((p) => p.payment_type === "membership_renewal").map((p) => p.amount)) },
    { name: "Upgrades", amount: 0 },
    { name: "PT Sessions", amount: sum(monthPayments.filter((p) => p.payment_type === "personal_training").map((p) => p.amount)) },
    { name: "Class Fees", amount: sum(monthPayments.filter((p) => p.payment_type === "class_fee").map((p) => p.amount)) },
    { name: "Other", amount: sum(monthPayments.filter((p) => p.payment_type && !["membership_purchase", "membership_renewal", "personal_training", "class_fee"].includes(p.payment_type)).map((p) => p.amount)) }
  ].filter((r) => r.amount > 0);

  const classUtilizationView = supabase.from("class_session_utilization").select("*").gte("session_date", last90).limit(200);
  const classWaitlistsView = supabase.from("class_waitlists").select("*").limit(200);
  const [classUtilResult, waitlistResult] = await Promise.all([
    gymId ? classUtilizationView.eq("gym_id", gymId) : classUtilizationView,
    gymId ? classWaitlistsView.eq("gym_id", gymId) : classWaitlistsView
  ]);

  return {
    kpis,
    executiveSummary: {
      totalRevenue, mrr, arr, activeMembers, newMembers: newMembersThisMonth,
      churnRate, retentionRate, lifetimeValue: ltv, arpm, cac, nrr,
      expansionRevenue, refundRate, occupancyUtilization: occupancyUtil, branchPerformanceIndex: branchPerfIndex
    },
    revenueTrend,
    revenueSources,
    revenueIntelligence: {
      mrr, arr, deferredRevenue: 0, collectedRevenue, outstandingRevenue,
      refundRevenue, expansionRevenue, upgradeRevenue, downgradeRevenue,
      revenueByTenant, revenueByBranch, revenueByRegion, revenueByPlan, revenueByService, revenueBySource
    },
    membershipTrend,
    membershipAnalytics: {
      activeMemberships: activeMembers, newMemberships: newMembershipsThisMonth,
      renewals: renewalsThisMonth, freezes: freezesCount,
      expirations: expirationsCount, cancellations: cancellationsCount,
      cohorts: cohortPoints, planPopularity: []
    },
    retention: {
      retentionRate, churnRate, inactiveMembers: 0, estimatedLifetimeValue: ltv,
      churnRiskMembers: expiredMemberships.length + cancelledMemberships.length,
      day7Retention: cohortPoints.length > 0 ? average(cohortPoints.map((c) => c.retentionDay7)) : 0,
      day30Retention: cohortPoints.length > 0 ? average(cohortPoints.map((c) => c.retentionDay30)) : 0,
      day90Retention: cohortPoints.length > 0 ? average(cohortPoints.map((c) => c.retentionDay90)) : 0,
      annualRetention: cohortPoints.length > 0 ? average(cohortPoints.map((c) => c.retentionAnnual ?? 0)) : 0,
      churnTrends, churnByBranch: [], churnByPlan: [],
      churnPrediction: []
    },
    ltvAnalytics: {
      currentLtv: ltv, predictedLtv: ltv * 1.2, averageLtv: ltv,
      segments: ltvSegments,
      segmentRevenue: ltvSegments.map((s) => ({ segment: s.segment, amount: s.revenueContributed }))
    },
    attendanceTrend,
    attendanceHeatmap: buildAttendanceHeatmap(attendanceSessions),
    trainerScorecards: [],
    trainerPerformance,
    classScorecards: [],
    fitnessOutcomes: [],
    leadFunnel: buildLeadFunnel(leads),
    branchScorecards,
    branchRanking: { topPerformers, underperformers, growthLeaders },
    marketingAnalytics: {
      campaigns: campaignPoints, channelAnalysis, attribution: [],
      totalLeads, totalConversions: leadConversions, totalRevenue: monthRevenue, totalCac: cac, totalRoi: campaignPoints.length > 0 ? average(campaignPoints.map((c) => c.roi)) : 0
    },
    capacityAnalytics: {
      occupancyRates: capacityPoints, peakHours: [],
      overcrowdingRisk: capacityPoints.filter((c) => c.overcrowdingRisk === "high").map((c) => ({ branchName: c.branchName, risk: c.overcrowdingRisk }))
    },
    behaviorAnalytics: {
      segments: behaviorSegments, journey: journeyStages,
      engagementTrend: attendanceTrend.map((a) => ({ date: a.date, activeUsers: a.uniqueMembers, engagement: a.visits > 0 ? percent(a.uniqueMembers, a.visits) : 0 }))
    },
    forecasts,
    forecastScenarios,
    alerts: (alertsResult.data ?? []) as AnalyticsAlertRow[],
    alertHistory: (alertHistoryResult.data ?? []) as Database["public"]["Tables"]["analytics_alert_history"]["Row"][],
    insights: (insightsResult.data ?? []) as Database["public"]["Tables"]["analytics_insights"]["Row"][],
    savedReports: (savedReportsResult.data ?? []) as Database["public"]["Tables"]["saved_reports"]["Row"][],
    reportExports: [],
    dashboardConfigs: (configsResult.data ?? []) as Database["public"]["Tables"]["dashboard_configs"]["Row"][],
    forecastModels: (modelsResult.data ?? []) as Database["public"]["Tables"]["forecast_models"]["Row"][],
    businessMetrics: (metricsResult.data ?? []) as Database["public"]["Tables"]["business_metrics"]["Row"][]
  };
}

function kpi(key: string, label: string, category: KpiCard["category"], current: number, previous: number, value: string, comparisonLabel: string, detail: string): KpiCard {
  const change = percentageChange(current, previous);
  return { key, label, category, value, numericValue: Math.round(current * 100) / 100, detail, comparisonLabel, changePercentage: change, status: kpiStatus(change) };
}

function buildRevenueTrend(payments: PaymentRow[], from: string, to: string) {
  return dateRange(from, to).map((date) => {
    const dayPayments = payments.filter((p) => paymentDate(p) === date);
    return {
      date,
      revenue: sum(dayPayments.map((p) => p.amount)),
      membership: sum(dayPayments.filter((p) => p.payment_type === "membership_purchase").map((p) => p.amount)),
      renewal: sum(dayPayments.filter((p) => p.payment_type === "membership_renewal").map((p) => p.amount)),
      personalTraining: sum(dayPayments.filter((p) => p.payment_type === "personal_training").map((p) => p.amount)),
      classes: sum(dayPayments.filter((p) => p.payment_type === "class_fee").map((p) => p.amount))
    };
  });
}

function buildRevenueSources(payments: PaymentRow[], from: string, to: string) {
  const scoped = payments.filter((p) => inDateRange(paymentDate(p), from, to));
  const sources = [
    { source: "Membership Purchase", amount: sum(scoped.filter((p) => p.payment_type === "membership_purchase").map((p) => p.amount)) },
    { source: "Membership Renewal", amount: sum(scoped.filter((p) => p.payment_type === "membership_renewal").map((p) => p.amount)) },
    { source: "Personal Training", amount: sum(scoped.filter((p) => p.payment_type === "personal_training").map((p) => p.amount)) },
    { source: "Class Fees", amount: sum(scoped.filter((p) => p.payment_type === "class_fee").map((p) => p.amount)) },
    { source: "Other", amount: sum(scoped.filter((p) => p.payment_type === "other" || p.payment_type === "registration_fee").map((p) => p.amount)) }
  ];
  const total = sum(sources.map((s) => s.amount));
  return sources.map((s) => ({ ...s, percentage: percent(s.amount, total) })).filter((s) => s.amount > 0);
}

function buildMembershipTrend(members: MemberRow[], memberships: MembershipRow[], from: string, to: string) {
  return dateRange(from, to).map((date) => ({
    date,
    newMembers: members.filter((m) => m.created_at.slice(0, 10) === date).length,
    renewals: memberships.filter((m) => m.renewal_of_membership_id && m.created_at.slice(0, 10) === date).length,
    expired: memberships.filter((m) => m.status === "expired" && m.end_date === date).length
  }));
}

function buildRevenueByPlan(_payments: PaymentRow[], plans: MembershipPlanRow[]) {
  return plans.slice(0, 10).map((plan) => ({
    name: plan.name,
    amount: 0
  })).filter((r) => r.amount > 0);
}

function buildRevenueByBranch(payments: PaymentRow[], branches: BranchRow[]) {
  return branches.slice(0, 20).map((branch) => ({
    name: branch.name,
    amount: sum(payments.filter((p) => p.branch_id === branch.id).map((p) => p.amount))
  })).filter((r) => r.amount > 0);
}

function buildAttendanceHeatmap(sessions: AttendanceSessionRow[]) {
  const bySlot = new Map<string, number>();
  for (const session of sessions) {
    const date = new Date(session.check_in_at);
    const day = date.toLocaleDateString("en-IN", { weekday: "short" });
    const hour = `${String(date.getHours()).padStart(2, "0")}:00`;
    const key = `${day}-${hour}`;
    bySlot.set(key, (bySlot.get(key) ?? 0) + 1);
  }
  return Array.from(bySlot.entries()).map(([key, visits]) => {
    const [day = "", hour = ""] = key.split("-");
    return { day, hour, visits };
  }).sort((a, b) => a.day.localeCompare(b.day) || a.hour.localeCompare(b.hour)).slice(0, 80);
}

function buildAttendanceTrend(sessions: AttendanceSessionRow[]) {
  const byDate = new Map<string, { visits: number; members: Set<string> }>();
  for (const session of sessions) {
    const date = session.check_in_at.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, { visits: 0, members: new Set() });
    const entry = byDate.get(date)!;
    entry.visits += 1;
    entry.members.add(session.member_id);
  }
  return Array.from(byDate.entries()).map(([date, data]) => ({ date, visits: data.visits, uniqueMembers: data.members.size })).slice(-30);
}

function buildLeadFunnel(leads: LeadRow[]) {
  const total = leads.length;
  const bySourceStatus = new Map<string, { source: string; status: string; leads: number }>();
  for (const lead of leads) {
    const key = `${lead.source}-${lead.status}`;
    const current = bySourceStatus.get(key) ?? { source: lead.source, status: lead.status, leads: 0 };
    current.leads += 1;
    bySourceStatus.set(key, current);
  }
  return Array.from(bySourceStatus.values()).map((row) => ({
    ...row, source: formatAnalyticsLabel(row.source), status: formatAnalyticsLabel(row.status),
    conversionRate: row.status === "converted" ? percent(row.leads, total) : 0
  })).sort((a, b) => b.leads - a.leads);
}

function buildBranchScorecards(branches: BranchRow[], branchMetrics: BranchMetricRow[], organizations: OrganizationRow[]): BranchScorecardPoint[] {
  const orgMap = new Map(organizations.map((o) => [o.id, o.name]));
  return branches.slice(0, 50).map((branch, index) => {
    const metrics = branchMetrics.filter((bm) => bm.branch_id === branch.id);
    const latestMetric = metrics[0];
    return {
      branchId: branch.id, branchName: branch.name,
      organizationName: orgMap.get(branch.organization_id ?? "") ?? "Unknown",
      revenue: latestMetric ? Number(latestMetric.revenue_amount ?? 0) : 0,
      growthRate: 0, profitability: 0, membershipGrowth: 0,
      retentionRate: 0, trainerUtilization: latestMetric ? Number(latestMetric.trainer_utilization ?? 0) : 0,
      capacityUtilization: latestMetric ? Number(latestMetric.trainer_utilization ?? 0) : 0,
      memberCount: latestMetric ? Number(latestMetric.active_members ?? 0) : 0,
      newMembers: 0, churnedMembers: 0, rank: index + 1
    };
  });
}

function buildTrainerPerformance(trainers: TrainerRow[], sessions: TrainerSessionRow[]): TrainerPerformancePoint[] {
  return trainers.slice(0, 50).map((trainer, index) => {
    const trainerSessions = sessions.filter((s) => s.trainer_id === trainer.id);
    const completed = trainerSessions.filter((s) => s.status === "completed").length;
    const revenue = 0;
    return {
      trainerId: trainer.id, trainerName: trainer.display_name,
      sessionsDelivered: completed, revenueGenerated: revenue,
      retentionImpact: 0, attendanceRate: trainerSessions.length > 0 ? percent(completed, trainerSessions.length) : 0,
      customerSatisfaction: 0, upsellPerformance: 0, rank: index + 1
    };
  }).sort((a, b) => b.revenueGenerated - a.revenueGenerated);
}

function buildLtvSegments(ltvRows: AnalyticsLtvSnapshotRow[]): LtvSegmentPoint[] {
  const segments = new Map<string, { memberCount: number; currentLtv: number; predictedLtv: number; revenueContributed: number; retentionMonths: number; upgradeLikelihood: number }>();
  for (const row of ltvRows) {
    if (!segments.has(row.segment)) {
      segments.set(row.segment, { memberCount: 0, currentLtv: 0, predictedLtv: 0, revenueContributed: 0, retentionMonths: 0, upgradeLikelihood: 0 });
    }
    const s = segments.get(row.segment)!;
    s.memberCount += 1;
    s.currentLtv += row.current_ltv;
    s.predictedLtv += row.predicted_ltv ?? 0;
    s.revenueContributed += row.revenue_contributed;
    s.retentionMonths += row.retention_months;
    s.upgradeLikelihood += row.upgrade_likelihood ?? 0;
  }
  return Array.from(segments.entries()).map(([segment, data]) => ({
    segment: segment as LtvSegmentPoint["segment"],
    memberCount: data.memberCount,
    currentLtv: data.currentLtv,
    predictedLtv: data.predictedLtv,
    revenueContributed: data.revenueContributed,
    retentionMonths: Math.round(data.retentionMonths / Math.max(data.memberCount, 1)),
    upgradeLikelihood: data.memberCount > 0 ? Math.round((data.upgradeLikelihood / data.memberCount) * 100) / 100 : 0
  }));
}

function buildChannelAnalysis(campaigns: Database["public"]["Tables"]["analytics_marketing_campaigns"]["Row"][]): MarketingChannelPoint[] {
  const channels = new Map<string, { leads: number; conversions: number; revenue: number; spend: number }>();
  for (const c of campaigns) {
    if (!channels.has(c.channel)) channels.set(c.channel, { leads: 0, conversions: 0, revenue: 0, spend: 0 });
    const ch = channels.get(c.channel)!;
    ch.leads += c.leads_generated;
    ch.conversions += c.conversions;
    ch.revenue += c.revenue_generated;
    ch.spend += c.spend;
  }
  return Array.from(channels.entries()).map(([channel, data]) => ({
    channel, leads: data.leads, conversions: data.conversions, revenue: data.revenue,
    cac: data.conversions > 0 ? Math.round(data.spend / data.conversions) : 0,
    roi: data.spend > 0 ? Math.round(((data.revenue - data.spend) / data.spend) * 100) : 0
  }));
}

function buildForecastScenarios(monthRevenue: number, activeMembers: number, churnRate: number): ForecastScenarioPoint[] {
  const scenarios: ForecastScenarioPoint[] = [];
  const today = new Date();
  const dates = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i + 1, 1);
    return d.toISOString().slice(0, 7);
  });

  scenarios.push({
    scenario: "best_case",
    label: "Best Case - Expected Growth",
    revenueProjections: dates.map((d, i) => ({ date: d, value: Math.round(monthRevenue * Math.pow(1.08, i + 1)) })),
    membershipProjections: dates.map((d, i) => ({ date: d, value: Math.round(activeMembers * Math.pow(1.05, i + 1)) })),
    confidence: 65
  });

  scenarios.push({
    scenario: "expected_case",
    label: "Expected Case - Current Trend",
    revenueProjections: dates.map((d, i) => ({ date: d, value: Math.round(monthRevenue * Math.pow(1.03, i + 1)) })),
    membershipProjections: dates.map((d, i) => ({ date: d, value: Math.round(activeMembers * Math.pow(1.01, i + 1)) })),
    confidence: 80
  });

  scenarios.push({
    scenario: "worst_case",
    label: "Worst Case - Economic Slowdown",
    revenueProjections: dates.map((d, i) => ({ date: d, value: Math.round(monthRevenue * Math.pow(0.95, i + 1)) })),
    membershipProjections: dates.map((d, i) => ({ date: d, value: Math.round(activeMembers * Math.pow(0.92, i + 1)) })),
    confidence: 45
  });

  scenarios.push({
    scenario: "custom",
    label: "Custom Scenario",
    revenueProjections: dates.map((d, i) => ({ date: d, value: Math.round(monthRevenue * Math.pow(1.05, i + 1)) })),
    membershipProjections: dates.map((d, i) => ({ date: d, value: Math.round(activeMembers * Math.pow(1.03, i + 1)) })),
    confidence: 50
  });

  return scenarios;
}

function paymentDate(p: PaymentRow) { return (p.paid_at ?? p.collected_at ?? p.created_at).slice(0, 10); }
function inDateRange(value: string, from: string, to: string) { const d = value.slice(0, 10); return d >= from && d <= to; }

function dateRange(from: string, to: string) {
  const days = Math.max(differenceInCalendarDays(new Date(to), new Date(from)), 0);
  return Array.from({ length: days + 1 }, (_, i) => formatISO(addDays(new Date(from), i), { representation: "date" }));
}

function sum(values: number[]) { return values.reduce((t, v) => t + v, 0); }
function average(values: number[]) { const u = values.filter((v) => Number.isFinite(v)); return u.length > 0 ? Math.round(sum(u) / u.length) : 0; }

function queryScope<QB extends { eq: (c: string, v: string) => QB }>(query: QB, gymId: string | null, _orgId?: string | null) {
  return gymId ? query.eq("gym_id", gymId) : query;
}

function orgScope<QB extends { eq: (c: string, v: string) => QB }>(query: QB, orgId: string | null | undefined) {
  return orgId ? query.eq("organization_id", orgId) : query;
}

function systemQuery<QB extends { or: (f: string) => QB }>(query: QB, gymId: string | null) {
  return gymId ? query.or(`gym_id.eq.${gymId},gym_id.is.null`) : query;
}
