import type {
  AiChurnRiskCategory,
  AiDashboardMetric,
  AiFitnessContext,
  AiFitnessLevel,
  AiForecastPoint,
  AiGeneratedRecommendation,
  AiInsightSeverity,
  AiRecommendedAction
} from "@/types/ai";

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateEngagementScore(signals: AiFitnessContext["signals"]) {
  const attendanceScore = Math.min(signals.attendanceLast30Days / 16, 1) * 30;
  const workoutScore = Math.min(signals.workoutsLast30Days / 12, 1) * 25;
  const classScore = Math.min(signals.classesBookedLast30Days / 8, 1) * 15;
  const nutritionScore = Math.min(signals.nutritionLogsLast7Days / 7, 1) * 10;
  const goalScore = Math.min(signals.activeGoals, 2) * 5;
  const streakScore = Math.min(signals.currentStreak / 14, 1) * 10;

  return clampScore(attendanceScore + workoutScore + classScore + nutritionScore + goalScore + streakScore);
}

export function calculateChurnRiskScore(signals: AiFitnessContext["signals"]) {
  const absenceRisk = signals.daysSinceLastVisit === null ? 25 : Math.min(signals.daysSinceLastVisit * 2.5, 45);
  const workoutDropRisk = signals.workoutsLast30Days === 0 ? 20 : signals.workoutsLast30Days < 4 ? 12 : 0;
  const attendanceRisk = signals.attendanceLast30Days < 4 ? 18 : signals.attendanceLast30Days < 8 ? 9 : 0;
  const expiryRisk = signals.membershipDaysRemaining === null ? 8 : signals.membershipDaysRemaining <= 7 ? 22 : signals.membershipDaysRemaining <= 30 ? 12 : 0;
  const engagementOffset = calculateEngagementScore(signals) * 0.25;

  return clampScore(absenceRisk + workoutDropRisk + attendanceRisk + expiryRisk - engagementOffset);
}

export function getChurnRiskCategory(score: number): AiChurnRiskCategory {
  if (score >= 80) {
    return "critical";
  }
  if (score >= 60) {
    return "high";
  }
  if (score >= 35) {
    return "medium";
  }
  return "low";
}

export function inferFitnessLevel(context: AiFitnessContext): AiFitnessLevel {
  const completedWorkouts = context.signals.workoutsLast30Days;
  const attendance = context.signals.attendanceLast30Days;
  const hasPerformanceGoal = context.goals.some((goal) => /strength|muscle|endurance|athletic/i.test(goal.title));

  if (attendance >= 20 && completedWorkouts >= 16 && hasPerformanceGoal) {
    return "athlete";
  }
  if (attendance >= 14 && completedWorkouts >= 10) {
    return "advanced";
  }
  if (attendance >= 6 || completedWorkouts >= 4) {
    return "intermediate";
  }
  return "beginner";
}

export function summarizeFitnessContext(context: AiFitnessContext) {
  const primaryGoal = context.goals.find((goal) => goal.status === "active")?.title ?? "general fitness";
  const riskScore = calculateChurnRiskScore(context.signals);
  const engagementScore = calculateEngagementScore(context.signals);

  return `${context.member.full_name} is focused on ${primaryGoal}. Engagement is ${engagementScore}/100 and churn risk is ${riskScore}/100 based on ${context.signals.attendanceLast30Days} visits, ${context.signals.workoutsLast30Days} workouts, and ${context.signals.nutritionLogsLast7Days} nutrition logs.`;
}

export function generateMemberRecommendations(context: AiFitnessContext): AiGeneratedRecommendation[] {
  const recommendations: AiGeneratedRecommendation[] = [];
  const riskScore = calculateChurnRiskScore(context.signals);
  const engagementScore = calculateEngagementScore(context.signals);
  const primaryGoal = context.goals.find((goal) => goal.status === "active")?.title ?? "general fitness";

  if (context.signals.workoutsLast30Days < 6) {
    recommendations.push({
      type: "workout",
      title: "Build a repeatable weekly training rhythm",
      summary: "Start with three focused sessions per week before increasing volume.",
      explanation: `Workout completion is currently ${context.signals.workoutsLast30Days} sessions in 30 days, so consistency will create the fastest improvement.`,
      confidence: 86,
      priority: "high",
      evidence: [
        { label: "Workouts in 30 days", value: context.signals.workoutsLast30Days, weight: 0.45 },
        { label: "Current goal", value: primaryGoal, weight: 0.25 }
      ],
      actions: [
        action("Schedule three training days", "Choose fixed workout days and keep one recovery day between hard sessions.", "member", 2),
        action("Trainer form review", "Ask a trainer to review the first compound lift in the next session.", "trainer", 7)
      ]
    });
  }

  if (context.signals.nutritionLogsLast7Days < 3) {
    recommendations.push({
      type: "nutrition",
      title: "Improve nutrition visibility with simple logging",
      summary: "Log protein and water for seven days before changing calories aggressively.",
      explanation: "Nutrition adherence cannot be judged reliably until recent meals and water intake are visible.",
      confidence: 78,
      priority: "medium",
      evidence: [{ label: "Nutrition logs in 7 days", value: context.signals.nutritionLogsLast7Days, weight: 0.5 }],
      actions: [
        action("Track breakfast and water", "Use a quick log after breakfast and before bed.", "member", 1),
        action("Review protein target", "Trainer or nutrition coach should validate the target against the member goal.", "trainer", 7)
      ]
    });
  }

  if (riskScore >= 45) {
    recommendations.push({
      type: "retention",
      title: "Trigger a retention check-in",
      summary: "A personal outreach is recommended before the member disengages further.",
      explanation: `Churn risk is ${riskScore}/100 with recent attendance and membership expiry signals contributing to risk.`,
      confidence: 82,
      priority: riskScore >= 70 ? "urgent" : "high",
      evidence: [
        { label: "Risk score", value: riskScore, weight: 0.55 },
        { label: "Days since last visit", value: context.signals.daysSinceLastVisit ?? "unknown", weight: 0.3 }
      ],
      actions: [
        action("Call member", "Ask what changed and offer a goal reset session.", "admin", 2),
        action("Book goal review", "Schedule a 20-minute review with the assigned trainer.", "trainer", 5)
      ]
    });
  }

  if (engagementScore >= 70 && context.signals.classesBookedLast30Days < 2) {
    recommendations.push({
      type: "class",
      title: "Add one class for variety and adherence",
      summary: "A weekly class can improve retention without replacing the current plan.",
      explanation: "Engagement is strong, but class participation is low. A relevant class can add structure and community.",
      confidence: 72,
      priority: "low",
      evidence: [{ label: "Classes booked in 30 days", value: context.signals.classesBookedLast30Days, weight: 0.35 }],
      actions: [action("Try one class this week", "Choose a class aligned with the active goal and recovery needs.", "member", 7)]
    });
  }

  const fallbackRecommendation: AiGeneratedRecommendation = {
    type: "workout",
    title: "Maintain the current training cadence",
    summary: "Current signals are stable. Continue the active program and review progress weekly.",
    explanation: `Engagement is ${engagementScore}/100 with no urgent risk signal.`,
    confidence: 70,
    priority: "low",
    evidence: [{ label: "Engagement score", value: engagementScore, weight: 0.4 }],
    actions: [action("Weekly check-in", "Review workout completion, weight trend, and energy levels.", "member", 7)]
  };

  return recommendations.length > 0 ? recommendations : [fallbackRecommendation];
}

export function buildForecast(values: number[], label: string, horizonDays: number): AiForecastPoint {
  const recent = values.slice(-7);
  const baseline = recent.length > 0 ? average(recent) : average(values);
  const trend = values.length >= 2 ? (values[values.length - 1] ?? 0) - (values[Math.max(values.length - 8, 0)] ?? 0) : 0;
  const forecastValue = Math.max(0, Math.round((baseline * horizonDays) + trend));
  const confidence = values.length >= 21 ? 78 : values.length >= 7 ? 62 : 45;
  const spread = Math.max(1, Math.round(forecastValue * (confidence >= 70 ? 0.12 : 0.22)));

  return {
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    label,
    forecastValue,
    lowerBound: Math.max(0, forecastValue - spread),
    upperBound: forecastValue + spread,
    confidence,
    horizonDays,
    explanation: values.length > 0
      ? `Forecast uses a recent moving baseline and short-term trend from ${values.length} data points.`
      : "Forecast uses a conservative baseline because historical data is not available."
  };
}

export function scoreTrainerMatch(input: {
  goal: string;
  trainerSpecialization: string | null;
  trainerRating: number;
  availabilityScore: number;
  retentionScore: number;
}) {
  const specializationMatch = input.trainerSpecialization && input.goal.toLowerCase().includes(input.trainerSpecialization.toLowerCase()) ? 35 : 18;
  const ratingScore = Math.min(input.trainerRating / 5, 1) * 25;
  const availabilityScore = Math.min(input.availabilityScore, 100) * 0.2;
  const retentionScore = Math.min(input.retentionScore, 100) * 0.2;

  return clampScore(specializationMatch + ratingScore + availabilityScore + retentionScore);
}

export function getInsightSeverity(score: number): AiInsightSeverity {
  if (score >= 80) {
    return "critical";
  }
  if (score >= 60) {
    return "warning";
  }
  if (score >= 35) {
    return "opportunity";
  }
  return "info";
}

export function kpiStatus(value: number, warningThreshold: number, riskThreshold: number): AiDashboardMetric["status"] {
  if (value >= riskThreshold) {
    return "risk";
  }
  if (value >= warningThreshold) {
    return "watch";
  }
  return "good";
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function action(label: string, description: string, ownerRole: AiRecommendedAction["ownerRole"], dueInDays: number): AiRecommendedAction {
  return { label, description, ownerRole, dueInDays };
}

function average(values: number[]) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) {
    return 0;
  }

  return filtered.reduce((total, value) => total + value, 0) / filtered.length;
}
