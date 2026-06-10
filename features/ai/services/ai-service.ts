import { differenceInCalendarDays, formatISO, subDays } from "date-fns";
import { getExecutiveAnalyticsDashboard } from "@/features/analytics/services/analytics-service";
import { getMemberAttendancePortal } from "@/features/attendance/services/attendance-service";
import { getMemberClassesPortal } from "@/features/classes/services/class-service";
import { getMemberFitnessPortal } from "@/features/fitness/services/fitness-service";
import { getMemberDashboard } from "@/features/memberships/services/membership-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AdminAiDashboard,
  AiFitnessContext,
  AiGeneratedRecommendation,
  MemberAiDashboard,
  TrainerAiDashboard
} from "@/types/ai";
import type { Json } from "@/types/database";
import {
  buildForecast,
  calculateChurnRiskScore,
  calculateEngagementScore,
  formatPercent,
  generateMemberRecommendations,
  getChurnRiskCategory,
  getInsightSeverity,
  inferFitnessLevel,
  kpiStatus,
  summarizeFitnessContext
} from "../lib/business-rules";
import { contentDraftPrompt, executiveInsightPrompt, memberCoachPrompt, nutritionAssistantPrompt, workoutProgramPrompt } from "../lib/prompt-layer";
import { appendSafetyDisclaimer, minimizeFitnessContext } from "../lib/safety";
import { generateAiText } from "./openai-service";

type RecommendationInsert = {
  gym_id: string | null;
  member_id: string | null;
  trainer_id: string | null;
  recommendation_type: AiGeneratedRecommendation["type"];
  title: string;
  summary: string;
  explanation: string;
  confidence: number;
  priority: AiGeneratedRecommendation["priority"];
  status: "pending_review";
  human_review_required: true;
  evidence: Json;
  recommended_actions: Json;
  created_by: string | null;
};

export async function getMemberAiDashboard(userId: string): Promise<MemberAiDashboard> {
  const supabase = await createSupabaseServerClient();
  const context = await buildMemberFitnessContext(userId);

  if (!context) {
    return {
      fitnessProfile: null,
      context: null,
      recommendations: [],
      storedRecommendations: [],
      progressInsight: null,
      chatSessions: []
    };
  }

  let insightQuery = supabase.from("ai_insights").select("*").eq("insight_type", "progress").order("created_at", { ascending: false }).limit(1);
  if (context.member.gym_id) {
    insightQuery = insightQuery.eq("gym_id", context.member.gym_id);
  }

  const [profileResult, recommendationsResult, insightsResult, sessionsResult] = await Promise.all([
    supabase.from("ai_fitness_profiles").select("*").eq("member_id", context.member.id).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ai_recommendations").select("*").eq("member_id", context.member.id).order("created_at", { ascending: false }).limit(12),
    insightQuery.maybeSingle(),
    supabase.from("ai_chat_sessions").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(8)
  ]);

  const firstError = [profileResult, recommendationsResult, insightsResult, sessionsResult].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  return {
    fitnessProfile: profileResult.data ?? null,
    context,
    recommendations: generateMemberRecommendations(context),
    storedRecommendations: recommendationsResult.data ?? [],
    progressInsight: insightsResult.data ?? null,
    chatSessions: sessionsResult.data ?? []
  };
}

export async function getTrainerAiDashboard(userId: string, gymId: string | null): Promise<TrainerAiDashboard> {
  const supabase = await createSupabaseServerClient();
  let trainerQuery = supabase.from("trainers").select("id,display_name,status").eq("user_id", userId);
  if (gymId) {
    trainerQuery = trainerQuery.eq("gym_id", gymId);
  }

  const { data: trainer, error: trainerError } = await trainerQuery.maybeSingle();
  if (trainerError) {
    throw new Error(trainerError.message);
  }

  if (!trainer) {
    return { trainer: null, riskMembers: [], recommendations: [], programDrafts: [] };
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("trainer_assignments")
    .select("member_id")
    .eq("trainer_id", trainer.id)
    .eq("status", "active");

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  const memberIds = (assignments ?? []).map((assignment) => assignment.member_id);
  if (memberIds.length === 0) {
    return { trainer, riskMembers: [], recommendations: [], programDrafts: [] };
  }

  const [riskResult, recommendationsResult, programResult] = await Promise.all([
    supabase.from("ai_member_risk_summary").select("*").in("member_id", memberIds).order("churn_risk_score", { ascending: false }),
    supabase.from("ai_recommendations").select("*").in("member_id", memberIds).order("created_at", { ascending: false }).limit(30),
    supabase.from("ai_generated_programs").select("*").eq("trainer_id", trainer.id).order("created_at", { ascending: false }).limit(20)
  ]);

  const firstError = [riskResult, recommendationsResult, programResult].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  return {
    trainer,
    riskMembers: riskResult.data ?? [],
    recommendations: recommendationsResult.data ?? [],
    programDrafts: programResult.data ?? []
  };
}

export async function getAdminAiDashboard(gymId: string | null): Promise<AdminAiDashboard> {
  const supabase = await createSupabaseServerClient();
  const analytics = await getExecutiveAnalyticsDashboard(gymId);

  const [recommendationsResult, insightsResult, riskResult, draftsResult, automationResult, logsResult] = await Promise.all([
    queryByGym(supabase.from("ai_recommendations").select("*").order("created_at", { ascending: false }).limit(20), gymId),
    queryByGym(supabase.from("ai_insights").select("*").order("created_at", { ascending: false }).limit(20), gymId),
    queryByGym(supabase.from("ai_member_risk_summary").select("*").order("churn_risk_score", { ascending: false }).limit(20), gymId),
    queryByGym(supabase.from("ai_content_drafts").select("*").order("created_at", { ascending: false }).limit(10), gymId),
    queryByGym(supabase.from("ai_automation_suggestions").select("*").order("created_at", { ascending: false }).limit(10), gymId),
    queryByGym(supabase.from("ai_observability_logs").select("*").gte("created_at", formatISO(subDays(new Date(), 30))).order("created_at", { ascending: false }).limit(200), gymId)
  ]);

  const firstError = [recommendationsResult, insightsResult, riskResult, draftsResult, automationResult, logsResult].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const logs = logsResult.data ?? [];
  const blocked = logs.filter((log) => log.status === "blocked").length;
  const fallbacks = logs.filter((log) => log.status === "fallback" || log.status === "error").length;
  const averageLatency = logs.length > 0 ? Math.round(logs.reduce((total, log) => total + log.latency_ms, 0) / logs.length) : 0;
  const riskMembers = riskResult.data ?? [];
  const criticalRiskMembers = riskMembers.filter((member) => (member.churn_risk_score ?? 0) >= 70).length;
  const revenueForecast = buildForecast(analytics.revenueTrend.map((row) => row.revenue), "Monthly revenue", 30);
  const attendanceForecast = buildForecast(analytics.attendanceTrend.map((row) => row.visits), "Attendance demand", 14);

  return {
    metrics: [
      {
        label: "Churn Risk",
        value: String(criticalRiskMembers),
        detail: "Members needing urgent intervention",
        status: kpiStatus(criticalRiskMembers, 5, 15)
      },
      {
        label: "AI Confidence",
        value: formatPercent(average([revenueForecast.confidence, attendanceForecast.confidence])),
        detail: "Forecast confidence baseline",
        status: "good"
      },
      {
        label: "Fallback Rate",
        value: formatPercent(percent(fallbacks, logs.length)),
        detail: "AI requests using deterministic fallback",
        status: kpiStatus(percent(fallbacks, logs.length), 20, 50)
      },
      {
        label: "Blocked Outputs",
        value: String(blocked),
        detail: "Safety policy interventions",
        status: kpiStatus(blocked, 3, 10)
      }
    ],
    recommendations: recommendationsResult.data ?? [],
    insights: insightsResult.data ?? buildRuleBasedExecutiveInsights(analytics, gymId),
    forecasts: [revenueForecast, attendanceForecast, buildForecast(analytics.membershipTrend.map((row) => row.renewals), "Renewal demand", 30)],
    riskMembers,
    contentDrafts: draftsResult.data ?? [],
    automationSuggestions: automationResult.data ?? [],
    observability: {
      totalRequests: logs.length,
      fallbackRate: percent(fallbacks, logs.length),
      averageLatencyMs: averageLatency,
      blockedRequests: blocked
    }
  };
}

export async function saveLatestMemberAiProfile(input: { userId: string; createdBy: string | null }) {
  const context = await buildMemberFitnessContext(input.userId);
  if (!context) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const engagement = calculateEngagementScore(context.signals);
  const churnRisk = calculateChurnRiskScore(context.signals);
  const level = inferFitnessLevel(context);
  const summary = summarizeFitnessContext(context);

  const { data, error } = await supabase.from("ai_fitness_profiles").insert({
    gym_id: context.member.gym_id,
    member_id: context.member.id,
    profile_version: Date.now(),
    fitness_level: level,
    primary_goal: context.goals.find((goal) => goal.status === "active")?.title ?? null,
    engagement_score: engagement,
    churn_risk_score: churnRisk,
    churn_risk_category: getChurnRiskCategory(churnRisk),
    context_summary: summary,
    signals: minimizeFitnessContext(context.signals),
    generated_by: "rules_engine"
  }).select("*").maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const generatedRecommendations = generateMemberRecommendations(context);
  await saveRecommendations({
    context,
    recommendations: generatedRecommendations,
    createdBy: input.createdBy
  });

  return data;
}

export async function generateCoachReply(input: { userId: string; message: string; sessionId?: string | null }) {
  const context = await buildMemberFitnessContext(input.userId);
  const gymId = context?.member.gym_id ?? null;
  const supabase = await createSupabaseServerClient();
  const sessionId = await getOrCreateChatSession({ userId: input.userId, gymId, memberId: context?.member.id ?? null, sessionId: input.sessionId ?? null });
  const knowledge = await searchKnowledgeSnippets({ gymId, query: input.message });
  const fallback = buildCoachFallback(input.message, context);
  const result = await generateAiText({
    featureKey: "member_ai_coach_chat",
    prompt: memberCoachPrompt({ message: input.message, context, knowledge }),
    fallback,
    gymId,
    userId: input.userId
  });

  await supabase.from("ai_chat_messages").insert([
    {
      session_id: sessionId,
      role: "user",
      content: input.message,
      safety_flags: [] as Json
    },
    {
      session_id: sessionId,
      role: "assistant",
      content: result.content,
      citations: knowledge.map((snippet) => ({ snippet: snippet.slice(0, 140) })) as Json,
      safety_flags: result.safetyFlags as Json
    }
  ]);

  return { sessionId, reply: result.content, status: result.status, safetyFlags: result.safetyFlags };
}

export async function generateWorkoutProgramDraft(input: { userId: string; level: "beginner" | "intermediate" | "advanced"; weeks: number; generatedBy: string | null }) {
  const context = await buildMemberFitnessContext(input.userId);
  if (!context) {
    throw new Error("No member fitness context is available.");
  }

  const result = await generateAiText({
    featureKey: "workout_program_generator",
    prompt: workoutProgramPrompt({ context, level: input.level, weeks: input.weeks }),
    fallback: buildProgramFallback(context, input.level, input.weeks),
    gymId: context.member.gym_id,
    userId: input.generatedBy
  });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ai_generated_programs").insert({
    gym_id: context.member.gym_id,
    member_id: context.member.id,
    trainer_id: context.member.assigned_trainer_id,
    name: `${input.level} ${context.goals[0]?.title ?? "fitness"} plan`,
    level: input.level,
    goal: context.goals[0]?.title ?? "general fitness",
    duration_weeks: input.weeks,
    program_json: { content: result.content, source: result.status } as Json,
    recovery_guidance: "Review sleep, soreness, and session readiness weekly.",
    safety_notes: "Trainer approval is required before assigning this AI-generated plan.",
    status: "pending_review",
    generated_by: input.generatedBy
  }).select("*").maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "AI program draft could not be created.");
  }

  return data;
}

export async function generateNutritionGuidance(input: { userId: string; goal: string }) {
  const context = await buildMemberFitnessContext(input.userId);
  if (!context) {
    return appendSafetyDisclaimer("No member profile is connected yet. Complete onboarding before generating nutrition guidance.");
  }

  const result = await generateAiText({
    featureKey: "nutrition_assistant",
    prompt: nutritionAssistantPrompt({ context, goal: input.goal }),
    fallback: "Start with consistent meal timing, adequate protein at each meal, water intake, and weekly review of body measurements and energy levels.",
    gymId: context.member.gym_id,
    userId: input.userId
  });

  return result.content;
}

export async function generateExecutiveInsightDraft(input: { gymId: string | null; userId: string | null }) {
  const dashboard = await getAdminAiDashboard(input.gymId);
  const result = await generateAiText({
    featureKey: "executive_insight_summary",
    prompt: executiveInsightPrompt({
      metrics: Object.fromEntries(dashboard.metrics.map((metric) => [metric.label, metric.value])),
      risks: dashboard.riskMembers.slice(0, 5).map((member) => `${member.full_name}: ${member.churn_risk_score ?? 0}% churn risk`)
    }),
    fallback: "Review churn-risk members, inspect revenue trend changes, and prioritize trainer outreach for members with declining attendance.",
    gymId: input.gymId,
    userId: input.userId
  });

  return result.content;
}

export async function generateContentDraft(input: { gymId: string | null; userId: string | null; draftType: string; audience: string; brief: string }) {
  const result = await generateAiText({
    featureKey: "ai_content_generation",
    prompt: contentDraftPrompt({ draftType: input.draftType, audience: input.audience, brief: input.brief }),
    fallback: `Draft for ${input.audience}: ${input.brief}. Keep the message clear, useful, and reviewed by staff before publishing.`,
    gymId: input.gymId,
    userId: input.userId
  });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ai_content_drafts").insert({
    gym_id: input.gymId,
    draft_type: normalizeDraftType(input.draftType),
    prompt: input.brief,
    content: result.content,
    target_segment: input.audience,
    status: "pending_review",
    safety_flags: result.safetyFlags as Json,
    generated_by: input.userId
  }).select("*").maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "AI content draft could not be created.");
  }

  return data;
}

async function buildMemberFitnessContext(userId: string): Promise<AiFitnessContext | null> {
  const [membership, attendance, classes, fitness] = await Promise.all([
    getMemberDashboard(userId),
    getMemberAttendancePortal(userId),
    getMemberClassesPortal(userId),
    getMemberFitnessPortal(userId)
  ]);

  if (!fitness) {
    return null;
  }

  const today = new Date();
  const activeMembership = membership?.currentMembership ?? null;
  const lastVisit = attendance?.metrics.lastVisitAt ? new Date(attendance.metrics.lastVisitAt) : null;
  const daysSinceLastVisit = lastVisit ? Math.max(0, differenceInCalendarDays(today, lastVisit)) : null;
  const membershipDaysRemaining = activeMembership?.end_date ? differenceInCalendarDays(new Date(activeMembership.end_date), today) : null;

  return {
    member: {
      id: fitness.member.id,
      gym_id: fitness.member.gym_id,
      full_name: fitness.member.full_name,
      member_code: fitness.member.member_code,
      status: fitness.member.status,
      assigned_trainer_id: fitness.member.assigned_trainer_id
    },
    trainer: fitness.trainer ? {
      id: fitness.trainer.id,
      display_name: fitness.trainer.display_name,
      status: "active"
    } : null,
    goals: fitness.goals.slice(0, 5).map((goal) => ({
      title: goal.title,
      goalType: goal.goal_type,
      status: goal.status,
      progress: goal.current_value && goal.target_value ? Math.round((Number(goal.current_value) / Number(goal.target_value)) * 100) : 0
    })),
    measurements: fitness.measurements.slice(0, 6).map((measurement) => ({
      date: measurement.recorded_on,
      weightKg: measurement.weight_kg,
      bodyFat: measurement.body_fat_percentage,
      bmi: measurement.bmi
    })),
    signals: {
      attendanceLast30Days: attendance?.metrics.monthlyVisits ?? 0,
      workoutsLast30Days: fitness.metrics.completedWorkouts,
      classesBookedLast30Days: classes?.bookings.filter((booking) => booking.created_at >= formatISO(subDays(today, 30))).length ?? 0,
      nutritionLogsLast7Days: fitness.mealEntries.filter((entry) => entry.entry_date >= formatISO(subDays(today, 7), { representation: "date" })).length,
      activeGoals: fitness.metrics.activeGoals,
      currentStreak: Math.max(fitness.metrics.workoutStreak, attendance?.metrics.currentStreak ?? 0),
      daysSinceLastVisit,
      membershipDaysRemaining
    }
  };
}

async function saveRecommendations(input: { context: AiFitnessContext; recommendations: AiGeneratedRecommendation[]; createdBy: string | null }) {
  const supabase = await createSupabaseServerClient();
  const rows: RecommendationInsert[] = input.recommendations.map((recommendation) => ({
    gym_id: input.context.member.gym_id,
    member_id: input.context.member.id,
    trainer_id: input.context.member.assigned_trainer_id,
    recommendation_type: recommendation.type,
    title: recommendation.title,
    summary: recommendation.summary,
    explanation: recommendation.explanation,
    confidence: recommendation.confidence,
    priority: recommendation.priority,
    status: "pending_review",
    human_review_required: true,
    evidence: recommendation.evidence as Json,
    recommended_actions: recommendation.actions as Json,
    created_by: input.createdBy
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("ai_recommendations").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

async function searchKnowledgeSnippets(input: { gymId: string | null; query: string }) {
  const supabase = await createSupabaseServerClient();
  const safeQuery = input.query.replace(/[%_,]/g, "").slice(0, 80);
  let query = supabase
    .from("ai_knowledge_chunks")
    .select("content")
    .ilike("content", `%${safeQuery}%`)
    .limit(5);

  if (input.gymId) {
    query = query.or(`gym_id.eq.${input.gymId},gym_id.is.null`);
  }

  const { data } = await query;
  return (data ?? []).map((row) => row.content);
}

async function getOrCreateChatSession(input: { userId: string; gymId: string | null; memberId: string | null; sessionId: string | null }) {
  const supabase = await createSupabaseServerClient();

  if (input.sessionId) {
    return input.sessionId;
  }

  const { data, error } = await supabase.from("ai_chat_sessions").insert({
    gym_id: input.gymId,
    member_id: input.memberId,
    user_id: input.userId,
    title: "AI coach session",
    status: "active"
  }).select("id").maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create AI chat session.");
  }

  return data.id;
}

function buildRuleBasedExecutiveInsights(analytics: Awaited<ReturnType<typeof getExecutiveAnalyticsDashboard>>, gymId: string | null) {
  const risk = analytics.retention.churnRiskMembers;
  const severity = getInsightSeverity(risk);

  return [{
    id: "generated-retention",
    gym_id: gymId,
    insight_type: "retention" as const,
    title: "Retention attention required",
    summary: `${risk} members show churn or inactivity risk based on expiry and attendance patterns.`,
    recommendation: "Prioritize trainer outreach, goal reviews, and renewal follow-ups for high-risk members.",
    severity,
    confidence: 76,
    evidence: [{ label: "Churn-risk members", value: risk }] as Json,
    status: "open" as const,
    generated_by: "rules_engine" as const,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }];
}

function buildCoachFallback(message: string, context: AiFitnessContext | null) {
  const goal = context?.goals.find((item) => item.status === "active")?.title ?? "your current goal";
  return `For ${goal}, keep the next step simple: complete your planned session, log the result, and review how your body responds. Your message was: "${message.slice(0, 120)}". Ask your trainer to review any pain, injury, or medical concern before changing intensity.`;
}

function buildProgramFallback(context: AiFitnessContext, level: string, weeks: number) {
  return `${weeks}-week ${level} plan for ${context.goals[0]?.title ?? "general fitness"}: train 3 days weekly, use compound movement practice, add one conditioning day, keep one mobility/recovery session, and progress load only when form is consistent. Trainer approval required.`;
}

function normalizeDraftType(value: string) {
  if (value === "campaign_email" || value === "whatsapp_message" || value === "promotion" || value === "report_summary") {
    return value;
  }
  return "announcement";
}

function percent(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.round((part / total) * 100);
}

function average(values: number[]) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) {
    return 0;
  }
  return filtered.reduce((total, value) => total + value, 0) / filtered.length;
}

function queryByGym<TQuery extends { eq: (column: string, value: string) => TQuery }>(query: TQuery, gymId: string | null): TQuery {
  return gymId ? query.eq("gym_id", gymId) : query;
}
