import { addDays, differenceInCalendarDays, formatISO, startOfMonth, subDays } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AnalyticsInsightRow,
  AnalyticsReportCategory,
  AnalyticsReportKey,
  AnalyticsReportPayload,
  ClassScorecard,
  ExecutiveAnalyticsDashboard,
  FitnessOutcomePoint,
  KpiCard,
  LeadFunnelPoint,
  MembershipTrendPoint,
  RevenueTrendPoint,
  TrainerScorecard
} from "@/types/analytics";
import type { Database } from "@/types/database";
import {
  buildForecastPoint,
  estimateLifetimeValue,
  formatAnalyticsLabel,
  formatCompactNumber,
  formatCurrency,
  kpiStatus,
  percent,
  percentageChange,
  reportTitle
} from "../lib/business-rules";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];
type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];
type MembershipPlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];
type TrainerRow = Database["public"]["Tables"]["trainers"]["Row"];
type TrainerSessionRow = Database["public"]["Tables"]["trainer_sessions"]["Row"];
type MemberPtPackageRow = Database["public"]["Tables"]["member_pt_packages"]["Row"];
type TrainerFeedbackRow = Database["public"]["Tables"]["trainer_feedback"]["Row"];
type FitnessGoalRow = Database["public"]["Tables"]["fitness_goals"]["Row"];
type WorkoutSessionRow = Database["public"]["Tables"]["workout_sessions"]["Row"];
type MealEntryRow = Database["public"]["Tables"]["meal_entries"]["Row"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type AttendanceSessionRow = Database["public"]["Tables"]["attendance_sessions"]["Row"];
type ClassUtilizationRow = Database["public"]["Views"]["class_session_utilization"]["Row"];
type FitnessProgressSummaryRow = Database["public"]["Views"]["fitness_member_progress_summary"]["Row"];
type AttendanceMemberFrequencyRow = Database["public"]["Views"]["attendance_member_frequency"]["Row"];

export async function getExecutiveAnalyticsDashboard(gymId: string | null): Promise<ExecutiveAnalyticsDashboard> {
  const supabase = await createSupabaseServerClient();
  const today = todayDate();
  const monthStart = formatISO(startOfMonth(new Date()), { representation: "date" });
  const previousMonthStart = formatISO(startOfMonth(subDays(new Date(monthStart), 1)), { representation: "date" });
  const last30 = formatISO(subDays(new Date(), 30), { representation: "date" });
  const last90 = formatISO(subDays(new Date(), 90), { representation: "date" });
  const last365 = formatISO(subDays(new Date(), 365), { representation: "date" });
  const next30 = formatISO(addDays(new Date(), 30), { representation: "date" });

  const [
    paymentsResult,
    membersResult,
    membershipsResult,
    plansResult,
    attendanceDailyResult,
    attendanceSessionsResult,
    frequencyResult,
    trainersResult,
    trainerSessionsResult,
    ptPackagesResult,
    feedbackResult,
    classUtilizationResult,
    classWaitlistsResult,
    fitnessSummaryResult,
    goalsResult,
    workoutsResult,
    mealsResult,
    leadsResult,
    savedReportsResult,
    exportsResult,
    configsResult,
    modelsResult,
    metricsResult,
    insightsResult
  ] = await Promise.all([
    queryByGym(supabase.from("payments").select("*").gte("created_at", `${last365}T00:00:00.000Z`).order("created_at", { ascending: false }).limit(5000), gymId),
    queryByGym(supabase.from("members").select("*").gte("created_at", `${last365}T00:00:00.000Z`).order("created_at", { ascending: false }).limit(5000), gymId),
    queryByGym(supabase.from("memberships").select("*").order("created_at", { ascending: false }).limit(8000), gymId),
    queryByGym(supabase.from("membership_plans").select("*").order("display_order", { ascending: true }), gymId),
    queryByGym(supabase.from("attendance_daily_summary").select("*").gte("attendance_date", last90).order("attendance_date", { ascending: true }), gymId),
    queryByGym(supabase.from("attendance_sessions").select("*").gte("check_in_at", `${last90}T00:00:00.000Z`).order("check_in_at", { ascending: false }).limit(10000), gymId),
    queryByGym(supabase.from("attendance_member_frequency").select("*").limit(5000), gymId),
    queryByGym(supabase.from("trainers").select("*").neq("status", "archived").order("display_name", { ascending: true }).limit(1000), gymId),
    queryByGym(supabase.from("trainer_sessions").select("*").gte("session_date", last90).order("session_date", { ascending: false }).limit(5000), gymId),
    queryByGym(supabase.from("member_pt_packages").select("*").gte("created_at", `${last365}T00:00:00.000Z`).order("created_at", { ascending: false }).limit(5000), gymId),
    queryByGym(supabase.from("trainer_feedback").select("*").neq("status", "hidden").gte("created_at", `${last365}T00:00:00.000Z`).limit(5000), gymId),
    queryByGym(supabase.from("class_session_utilization").select("*").gte("session_date", last90).order("session_date", { ascending: false }).limit(5000), gymId),
    queryByGym(supabase.from("class_waitlists").select("*").gte("joined_at", `${last90}T00:00:00.000Z`).limit(5000), gymId),
    queryByGym(supabase.from("fitness_member_progress_summary").select("*").limit(5000), gymId),
    queryByGym(supabase.from("fitness_goals").select("*").gte("created_at", `${last365}T00:00:00.000Z`).limit(5000), gymId),
    queryByGym(supabase.from("workout_sessions").select("*").gte("session_date", last90).limit(10000), gymId),
    queryByGym(supabase.from("meal_entries").select("*").gte("entry_date", last30).limit(10000), gymId),
    queryByGym(supabase.from("leads").select("*").gte("created_at", `${last365}T00:00:00.000Z`).limit(5000), gymId),
    scopedSystemQuery(supabase.from("saved_reports").select("*").eq("status", "active").order("category", { ascending: true }).order("name", { ascending: true }).limit(80), gymId),
    queryByGym(supabase.from("report_exports").select("*").order("created_at", { ascending: false }).limit(30), gymId),
    scopedSystemQuery(supabase.from("dashboard_configs").select("*").order("is_default", { ascending: false }).order("updated_at", { ascending: false }).limit(30), gymId),
    scopedSystemQuery(supabase.from("forecast_models").select("*").neq("status", "archived").order("created_at", { ascending: false }).limit(20), gymId),
    queryByGym(supabase.from("business_metrics").select("*").gte("metric_date", last90).order("metric_date", { ascending: false }).limit(1000), gymId),
    queryByGym(supabase.from("analytics_insights").select("*").in("status", ["open", "acknowledged"]).order("created_at", { ascending: false }).limit(30), gymId)
  ]);

  const firstError = [
    paymentsResult,
    membersResult,
    membershipsResult,
    plansResult,
    attendanceDailyResult,
    attendanceSessionsResult,
    frequencyResult,
    trainersResult,
    trainerSessionsResult,
    ptPackagesResult,
    feedbackResult,
    classUtilizationResult,
    classWaitlistsResult,
    fitnessSummaryResult,
    goalsResult,
    workoutsResult,
    mealsResult,
    leadsResult,
    savedReportsResult,
    exportsResult,
    configsResult,
    modelsResult,
    metricsResult,
    insightsResult
  ].find((result) => result.error)?.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const payments = paymentsResult.data ?? [];
  const members = membersResult.data ?? [];
  const memberships = membershipsResult.data ?? [];
  const plans = plansResult.data ?? [];
  const attendanceDaily = attendanceDailyResult.data ?? [];
  const attendanceSessions = attendanceSessionsResult.data ?? [];
  const frequencyRows = frequencyResult.data ?? [];
  const trainers = trainersResult.data ?? [];
  const trainerSessions = trainerSessionsResult.data ?? [];
  const ptPackages = ptPackagesResult.data ?? [];
  const feedback = feedbackResult.data ?? [];
  const classUtilization = classUtilizationResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const workouts = workoutsResult.data ?? [];
  const meals = mealsResult.data ?? [];
  const leads = leadsResult.data ?? [];

  const paidPayments = payments.filter((payment) => payment.status === "paid" || payment.status === "partially_refunded");
  const todayRevenue = revenueInRange(paidPayments, today, today);
  const monthRevenue = revenueInRange(paidPayments, monthStart, today);
  const previousMonthRevenue = revenueInRange(paidPayments, previousMonthStart, subDays(new Date(monthStart), 1).toISOString().slice(0, 10));
  const activeMemberships = memberships.filter((membership) => membership.status === "active");
  const expiredMemberships = memberships.filter((membership) => membership.status === "expired");
  const cancelledMemberships = memberships.filter((membership) => membership.status === "cancelled");
  const renewalsThisMonth = memberships.filter((membership) => membership.renewal_of_membership_id && inDateRange(membership.created_at, monthStart, today)).length;
  const newMembersThisMonth = members.filter((member) => inDateRange(member.created_at, monthStart, today)).length;
  const attendanceToday = attendanceSessions.filter((session) => session.check_in_at.slice(0, 10) === today).length;
  const trainerScorecards = buildTrainerScorecards(trainers, trainerSessions, ptPackages, feedback);
  const classScorecards = buildClassScorecards(classUtilization, classWaitlistsResult.data ?? []);
  const averageTrainerUtilization = average(trainerScorecards.map((row) => row.utilizationScore));
  const averageClassUtilization = average(classScorecards.map((row) => row.fillRate));
  const inactiveMembers = frequencyRows.filter((row) => inactiveDays(row) >= 15).length;
  const retentionRate = percent(activeMemberships.length, activeMemberships.length + expiredMemberships.length + cancelledMemberships.length);
  const churnRate = Math.max(0, 100 - retentionRate);
  const leadConversion = percent(leads.filter((lead) => lead.status === "converted").length, leads.length);
  const goalCompletionRate = percent(goals.filter((goal) => goal.status === "completed").length, goals.length);
  const estimatedLifetimeValue = estimateLifetimeValue(monthRevenue, activeMemberships.length, retentionRate);
  const revenueTrend = buildRevenueTrend(paidPayments, last30, today);
  const membershipTrend = buildMembershipTrend(members, memberships, last30, today);
  const attendanceTrend = attendanceDaily.map((row) => ({ date: row.attendance_date ?? "", visits: row.total_check_ins ?? 0, uniqueMembers: row.unique_members ?? 0 })).slice(-30);
  const attendanceHeatmap = buildAttendanceHeatmap(attendanceSessions);
  const leadFunnel = buildLeadFunnel(leads);
  const revenueSources = buildRevenueSources(paidPayments, monthStart, today);
  const planPopularity = buildPlanPopularity(activeMemberships, plans);
  const forecasts = [
    buildForecastPoint({ metricKey: "revenue_next_30_days", label: "Revenue next 30 days", values: revenueTrend.map((row) => row.revenue), horizonDays: 30 }),
    { metricKey: "renewals_next_30_days", label: "Renewals next 30 days", forecastValue: memberships.filter((membership) => inDateRange(membership.end_date, today, next30)).length, confidence: "baseline" as const, horizonDays: 30 },
    buildForecastPoint({ metricKey: "attendance_next_14_days", label: "Attendance next 14 days", values: attendanceTrend.map((row) => row.visits), horizonDays: 14 }),
    buildForecastPoint({ metricKey: "member_growth_next_90_days", label: "Member growth next 90 days", values: membershipTrend.map((row) => row.newMembers), horizonDays: 90 })
  ];
  const generatedInsights = buildGeneratedInsights({
    gymId,
    monthRevenue,
    previousMonthRevenue,
    attendanceToday,
    averageTrainerUtilization,
    averageClassUtilization,
    inactiveMembers,
    leadConversion,
    goalCompletionRate
  });

  return {
    kpis: [
      kpi("today_revenue", "Today's Revenue", "revenue", todayRevenue, 0, formatCurrency(todayRevenue), "Collected today", "Live daily revenue"),
      kpi("monthly_revenue", "Monthly Revenue", "revenue", monthRevenue, previousMonthRevenue, formatCurrency(monthRevenue), "vs last month", "Paid and partially refunded payments"),
      kpi("active_members", "Active Members", "membership", activeMemberships.length, expiredMemberships.length, formatCompactNumber(activeMemberships.length), `${expiredMemberships.length} expired`, "Current active memberships"),
      kpi("new_members", "New Members", "membership", newMembersThisMonth, 0, formatCompactNumber(newMembersThisMonth), "this month", "New member records"),
      kpi("renewals", "Renewals", "retention", renewalsThisMonth, 0, formatCompactNumber(renewalsThisMonth), "this month", "Renewal memberships"),
      kpi("attendance_today", "Attendance Today", "attendance", attendanceToday, 0, formatCompactNumber(attendanceToday), "check-ins", "Validated attendance sessions"),
      kpi("trainer_utilization", "Trainer Utilization", "trainer", averageTrainerUtilization, 75, `${averageTrainerUtilization}%`, "target 75%", "Completed vs scheduled sessions"),
      kpi("class_utilization", "Class Utilization", "class", averageClassUtilization, 70, `${averageClassUtilization}%`, "target 70%", "Average class fill rate")
    ],
    revenueTrend,
    revenueSources,
    membershipTrend,
    planPopularity,
    attendanceTrend,
    attendanceHeatmap,
    trainerScorecards,
    classScorecards,
    fitnessOutcomes: buildFitnessOutcomes(goals, workouts, meals, fitnessSummaryResult.data ?? []),
    leadFunnel,
    retention: {
      retentionRate,
      churnRate,
      inactiveMembers,
      estimatedLifetimeValue,
      churnRiskMembers: inactiveMembers + expiredMemberships.length
    },
    forecasts,
    insights: [...(insightsResult.data ?? []), ...generatedInsights],
    savedReports: savedReportsResult.data ?? [],
    reportExports: exportsResult.data ?? [],
    dashboardConfigs: configsResult.data ?? [],
    forecastModels: modelsResult.data ?? [],
    businessMetrics: metricsResult.data ?? []
  };
}

export async function getAnalyticsReportPayload(input: { gymId: string | null; reportKey: AnalyticsReportKey }): Promise<AnalyticsReportPayload> {
  const dashboard = await getExecutiveAnalyticsDashboard(input.gymId);
  const generatedAt = new Date().toISOString();

  if (input.reportKey === "revenue_sources") {
    return report(input.reportKey, "financial", ["date", "membership", "renewal", "personalTraining", "classes", "revenue"], dashboard.revenueTrend, generatedAt);
  }

  if (input.reportKey === "membership_retention") {
    return report(input.reportKey, "membership", ["date", "newMembers", "renewals", "expired"], dashboard.membershipTrend, generatedAt);
  }

  if (input.reportKey === "attendance_engagement") {
    return report(input.reportKey, "attendance", ["date", "visits", "uniqueMembers"], dashboard.attendanceTrend, generatedAt);
  }

  if (input.reportKey === "trainer_scorecard") {
    return report(input.reportKey, "trainer", ["trainerName", "assignedMembers", "completedSessions", "scheduledSessions", "completionRate", "ptRevenue", "averageRating", "utilizationScore"], dashboard.trainerScorecards, generatedAt);
  }

  if (input.reportKey === "class_utilization") {
    return report(input.reportKey, "class", ["className", "sessions", "fillRate", "booked", "capacity", "waitlist"], dashboard.classScorecards, generatedAt);
  }

  if (input.reportKey === "fitness_outcomes") {
    return report(input.reportKey, "fitness", ["label", "value", "detail"], dashboard.fitnessOutcomes, generatedAt);
  }

  if (input.reportKey === "sales_funnel") {
    return report(input.reportKey, "sales", ["source", "status", "leads", "conversionRate"], dashboard.leadFunnel, generatedAt);
  }

  return report(input.reportKey, "operations", ["label", "value", "category", "comparisonLabel", "changePercentage", "status"], dashboard.kpis, generatedAt);
}

function kpi(key: string, label: string, category: KpiCard["category"], current: number, previous: number, value: string, comparisonLabel: string, detail: string): KpiCard {
  const changePercentage = percentageChange(current, previous);
  return {
    key,
    label,
    category,
    value,
    numericValue: Math.round(current * 100) / 100,
    detail,
    comparisonLabel,
    changePercentage,
    status: kpiStatus(changePercentage)
  };
}

function report<T extends Record<string, string | number | null | undefined>>(key: AnalyticsReportKey, category: AnalyticsReportCategory, headers: string[], rows: T[], generatedAt: string): AnalyticsReportPayload {
  return {
    key,
    category,
    title: reportTitle(key),
    generatedAt,
    headers,
    rows: rows.map((row) => Object.fromEntries(headers.map((header) => [header, row[header] ?? null])))
  };
}

function buildRevenueTrend(payments: PaymentRow[], from: string, to: string): RevenueTrendPoint[] {
  return dateRange(from, to).map((date) => {
    const dayPayments = payments.filter((payment) => paymentDate(payment) === date);
    return {
      date,
      revenue: sum(dayPayments.map((payment) => payment.amount)),
      membership: sum(dayPayments.filter((payment) => payment.payment_type === "membership_purchase").map((payment) => payment.amount)),
      renewal: sum(dayPayments.filter((payment) => payment.payment_type === "membership_renewal").map((payment) => payment.amount)),
      personalTraining: sum(dayPayments.filter((payment) => payment.payment_type === "personal_training").map((payment) => payment.amount)),
      classes: sum(dayPayments.filter((payment) => payment.payment_type === "class_fee").map((payment) => payment.amount))
    };
  });
}

function buildRevenueSources(payments: PaymentRow[], from: string, to: string) {
  const scoped = payments.filter((payment) => inDateRange(paymentDate(payment), from, to));
  const sources = [
    { source: "Membership Purchase", amount: sum(scoped.filter((payment) => payment.payment_type === "membership_purchase").map((payment) => payment.amount)) },
    { source: "Membership Renewal", amount: sum(scoped.filter((payment) => payment.payment_type === "membership_renewal").map((payment) => payment.amount)) },
    { source: "Personal Training", amount: sum(scoped.filter((payment) => payment.payment_type === "personal_training").map((payment) => payment.amount)) },
    { source: "Class Fees", amount: sum(scoped.filter((payment) => payment.payment_type === "class_fee").map((payment) => payment.amount)) },
    { source: "Other", amount: sum(scoped.filter((payment) => payment.payment_type === "other" || payment.payment_type === "registration_fee").map((payment) => payment.amount)) }
  ];
  const total = sum(sources.map((source) => source.amount));
  return sources.map((source) => ({ ...source, percentage: percent(source.amount, total) })).filter((source) => source.amount > 0);
}

function buildMembershipTrend(members: MemberRow[], memberships: MembershipRow[], from: string, to: string): MembershipTrendPoint[] {
  return dateRange(from, to).map((date) => ({
    date,
    newMembers: members.filter((member) => member.created_at.slice(0, 10) === date).length,
    renewals: memberships.filter((membership) => membership.renewal_of_membership_id && membership.created_at.slice(0, 10) === date).length,
    expired: memberships.filter((membership) => membership.status === "expired" && membership.end_date === date).length
  }));
}

function buildPlanPopularity(activeMemberships: MembershipRow[], plans: MembershipPlanRow[]) {
  return plans.map((plan) => {
    const planMemberships = activeMemberships.filter((membership) => membership.membership_plan_id === plan.id);
    return {
      plan: plan.name,
      members: planMemberships.length,
      revenue: sum(planMemberships.map((membership) => membership.total_amount))
    };
  }).filter((item) => item.members > 0).sort((a, b) => b.members - a.members).slice(0, 8);
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

function buildTrainerScorecards(trainers: TrainerRow[], sessions: TrainerSessionRow[], packages: MemberPtPackageRow[], feedback: TrainerFeedbackRow[]): TrainerScorecard[] {
  return trainers.map((trainer) => {
    const trainerSessions = sessions.filter((session) => session.trainer_id === trainer.id);
    const completedSessions = trainerSessions.filter((session) => session.status === "completed").length;
    const scheduledSessions = trainerSessions.length;
    const assignedMembers = new Set(trainerSessions.map((session) => session.member_id)).size;
    const packageRows = packages.filter((item) => item.trainer_id === trainer.id);
    const ratingRows = feedback.filter((item) => item.trainer_id === trainer.id);
    const averageRating = ratingRows.length > 0 ? Math.round((sum(ratingRows.map((item) => item.rating)) / ratingRows.length) * 10) / 10 : 0;
    const completionRate = percent(completedSessions, scheduledSessions);
    return {
      trainerId: trainer.id,
      trainerName: trainer.display_name,
      assignedMembers,
      completedSessions,
      scheduledSessions,
      completionRate,
      ptRevenue: sum(packageRows.map((item) => item.price_amount)),
      averageRating,
      utilizationScore: Math.round((completionRate * 0.7) + (Math.min(assignedMembers, 20) / 20) * 30)
    };
  }).sort((a, b) => b.utilizationScore - a.utilizationScore).slice(0, 12);
}

function buildClassScorecards(utilization: ClassUtilizationRow[], waitlists: Array<{ class_id: string; status: string }>): ClassScorecard[] {
  const byClass = new Map<string, { className: string; sessions: number; fillTotal: number; booked: number; capacity: number; waitlist: number }>();
  for (const row of utilization) {
    const className = row.class_name ?? "Class";
    const current = byClass.get(className) ?? { className, sessions: 0, fillTotal: 0, booked: 0, capacity: 0, waitlist: 0 };
    current.sessions += 1;
    current.fillTotal += Number(row.fill_rate ?? 0);
    current.booked += row.booked_count ?? 0;
    current.capacity += row.capacity ?? 0;
    current.waitlist += waitlists.filter((waitlist) => waitlist.class_id === row.class_id && waitlist.status === "waiting").length;
    byClass.set(className, current);
  }
  return Array.from(byClass.values()).map((item) => ({
    className: item.className,
    sessions: item.sessions,
    fillRate: Math.round(item.fillTotal / Math.max(item.sessions, 1)),
    booked: item.booked,
    capacity: item.capacity,
    waitlist: item.waitlist
  })).sort((a, b) => b.fillRate - a.fillRate).slice(0, 12);
}

function buildFitnessOutcomes(goals: FitnessGoalRow[], workouts: WorkoutSessionRow[], meals: MealEntryRow[], summaries: FitnessProgressSummaryRow[]): FitnessOutcomePoint[] {
  return [
    { label: "Goal Completion", value: percent(goals.filter((goal) => goal.status === "completed").length, goals.length), detail: `${goals.length} tracked goals` },
    { label: "Workout Adherence", value: percent(workouts.filter((workout) => workout.status === "completed").length, workouts.length), detail: `${workouts.length} logged sessions` },
    { label: "Nutrition Compliance", value: percent(new Set(meals.map((meal) => meal.member_id)).size, summaries.length), detail: `${meals.length} meal logs in 30 days` },
    { label: "Members Progressing", value: percent(summaries.filter((summary) => (summary.completed_workouts ?? 0) > 0 || (summary.active_goals ?? 0) > 0).length, summaries.length), detail: `${summaries.length} tracked members` }
  ];
}

function buildLeadFunnel(leads: LeadRow[]): LeadFunnelPoint[] {
  const total = leads.length;
  const bySourceStatus = new Map<string, { source: string; status: string; leads: number }>();
  for (const lead of leads) {
    const key = `${lead.source}-${lead.status}`;
    const current = bySourceStatus.get(key) ?? { source: lead.source, status: lead.status, leads: 0 };
    current.leads += 1;
    bySourceStatus.set(key, current);
  }
  return Array.from(bySourceStatus.values()).map((row) => ({
    ...row,
    source: formatAnalyticsLabel(row.source),
    status: formatAnalyticsLabel(row.status),
    conversionRate: row.status === "converted" ? percent(row.leads, total) : 0
  })).sort((a, b) => b.leads - a.leads);
}

function buildGeneratedInsights(input: {
  gymId: string | null;
  monthRevenue: number;
  previousMonthRevenue: number;
  attendanceToday: number;
  averageTrainerUtilization: number;
  averageClassUtilization: number;
  inactiveMembers: number;
  leadConversion: number;
  goalCompletionRate: number;
}): AnalyticsInsightRow[] {
  const now = new Date().toISOString();
  const rows: AnalyticsInsightRow[] = [];
  const revenueChange = percentageChange(input.monthRevenue, input.previousMonthRevenue);
  if (input.previousMonthRevenue > 0 && revenueChange <= -10) {
    rows.push(generatedInsight("generated-revenue-drop", input.gymId, "revenue_drop", "high", "Revenue is trending down", `Monthly revenue is ${Math.abs(revenueChange)}% below the previous month.`, "monthly_revenue", input.monthRevenue, input.previousMonthRevenue, "Review renewal follow-ups, stalled invoices, and campaign performance.", now));
  }
  if (input.attendanceToday < 10) {
    rows.push(generatedInsight("generated-attendance-drop", input.gymId, "attendance_drop", "medium", "Attendance is low today", "Today attendance is below the expected operating threshold.", "attendance_today", input.attendanceToday, 10, "Trigger attendance reminders for inactive and high-value members.", now));
  }
  if (input.averageTrainerUtilization < 50) {
    rows.push(generatedInsight("generated-trainer-utilization", input.gymId, "trainer_underutilization", "medium", "Trainer utilization needs attention", "Average trainer utilization is below 50%.", "trainer_utilization", input.averageTrainerUtilization, 50, "Review session schedules, PT package sales, and trainer assignments.", now));
  }
  if (input.averageClassUtilization < 45) {
    rows.push(generatedInsight("generated-class-utilization", input.gymId, "class_underperformance", "medium", "Class fill rate is soft", "Average class utilization is below 45%.", "class_utilization", input.averageClassUtilization, 45, "Adjust class times, capacity, or promotion for underfilled classes.", now));
  }
  if (input.inactiveMembers > 0) {
    rows.push(generatedInsight("generated-churn-risk", input.gymId, "membership_churn_risk", "high", "Inactive members need retention follow-up", `${input.inactiveMembers} members have not visited recently.`, "inactive_members", input.inactiveMembers, 0, "Create a retention campaign for inactive members and assign staff follow-up.", now));
  }
  if (input.leadConversion < 15) {
    rows.push(generatedInsight("generated-sales-drop", input.gymId, "sales_drop", "medium", "Lead conversion can improve", `Current lead conversion is ${input.leadConversion}%.`, "lead_conversion", input.leadConversion, 15, "Audit response speed, trial booking workflow, and membership offer clarity.", now));
  }
  if (input.goalCompletionRate < 30) {
    rows.push(generatedInsight("generated-fitness-adherence", input.gymId, "fitness_adherence_drop", "low", "Fitness goal completion is low", `Goal completion is ${input.goalCompletionRate}%.`, "goal_completion", input.goalCompletionRate, 30, "Prompt trainers to update goals and check workout adherence for stalled members.", now));
  }
  return rows;
}

function generatedInsight(id: string, gymId: string | null, type: AnalyticsInsightRow["insight_type"], severity: AnalyticsInsightRow["severity"], title: string, description: string, metricKey: string, current: number, comparison: number, recommendation: string, now: string): AnalyticsInsightRow {
  return {
    id,
    gym_id: gymId,
    insight_type: type,
    severity,
    title,
    description,
    metric_key: metricKey,
    current_value: current,
    comparison_value: comparison,
    recommendation,
    status: "open",
    created_by: null,
    created_at: now,
    resolved_at: null
  };
}

function revenueInRange(payments: PaymentRow[], from: string, to: string) {
  return sum(payments.filter((payment) => inDateRange(paymentDate(payment), from, to)).map((payment) => payment.amount));
}

function paymentDate(payment: PaymentRow) {
  return (payment.paid_at ?? payment.collected_at ?? payment.created_at).slice(0, 10);
}

function inDateRange(value: string, from: string, to: string) {
  const date = value.slice(0, 10);
  return date >= from && date <= to;
}

function dateRange(from: string, to: string) {
  const days = Math.max(differenceInCalendarDays(new Date(to), new Date(from)), 0);
  return Array.from({ length: days + 1 }, (_, index) => formatISO(addDays(new Date(from), index), { representation: "date" }));
}

function inactiveDays(row: AttendanceMemberFrequencyRow) {
  return row.last_visit_at ? differenceInCalendarDays(new Date(), new Date(row.last_visit_at)) : 999;
}

function average(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length === 0) {
    return 0;
  }
  return Math.round(sum(usable) / usable.length);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function queryByGym<QueryBuilder extends { eq: (column: string, value: string) => QueryBuilder }>(query: QueryBuilder, gymId: string | null) {
  return gymId ? query.eq("gym_id", gymId) : query;
}

function scopedSystemQuery<QueryBuilder extends { or: (filters: string) => QueryBuilder }>(query: QueryBuilder, gymId: string | null) {
  return gymId ? query.or(`gym_id.eq.${gymId},gym_id.is.null`) : query;
}
