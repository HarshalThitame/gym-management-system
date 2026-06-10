import type { Database, Json } from "./database";
import type { MemberRow } from "./membership";
import type { TrainerRow } from "./training";

export const aiRecommendationTypes = ["workout", "nutrition", "class", "trainer_match", "retention", "automation", "content", "executive"] as const;
export const aiRecommendationStatuses = ["draft", "pending_review", "approved", "rejected", "applied", "archived"] as const;
export const aiPredictionTypes = ["engagement", "churn", "retention", "revenue", "attendance", "demand", "trainer_match", "class_recommendation"] as const;
export const aiInsightTypes = ["progress", "executive", "revenue", "attendance", "trainer", "class", "retention", "fitness"] as const;
export const aiInsightSeverities = ["info", "opportunity", "warning", "critical"] as const;
export const aiContentDraftTypes = ["announcement", "campaign_email", "whatsapp_message", "promotion", "report_summary"] as const;
export const aiFitnessLevels = ["beginner", "intermediate", "advanced", "athlete"] as const;
export const aiChurnRiskCategories = ["low", "medium", "high", "critical"] as const;

export type AiRecommendationType = (typeof aiRecommendationTypes)[number];
export type AiRecommendationStatus = (typeof aiRecommendationStatuses)[number];
export type AiPredictionType = (typeof aiPredictionTypes)[number];
export type AiInsightType = (typeof aiInsightTypes)[number];
export type AiInsightSeverity = (typeof aiInsightSeverities)[number];
export type AiContentDraftType = (typeof aiContentDraftTypes)[number];
export type AiFitnessLevel = (typeof aiFitnessLevels)[number];
export type AiChurnRiskCategory = (typeof aiChurnRiskCategories)[number];

export type AiFitnessProfileRow = Database["public"]["Tables"]["ai_fitness_profiles"]["Row"];
export type AiRecommendationRow = Database["public"]["Tables"]["ai_recommendations"]["Row"];
export type AiGeneratedProgramRow = Database["public"]["Tables"]["ai_generated_programs"]["Row"];
export type AiChatSessionRow = Database["public"]["Tables"]["ai_chat_sessions"]["Row"];
export type AiChatMessageRow = Database["public"]["Tables"]["ai_chat_messages"]["Row"];
export type AiKnowledgeDocumentRow = Database["public"]["Tables"]["ai_knowledge_documents"]["Row"];
export type AiKnowledgeChunkRow = Database["public"]["Tables"]["ai_knowledge_chunks"]["Row"];
export type AiPredictionRow = Database["public"]["Tables"]["ai_predictions"]["Row"];
export type AiForecastRow = Database["public"]["Tables"]["ai_forecasts"]["Row"];
export type AiInsightRow = Database["public"]["Tables"]["ai_insights"]["Row"];
export type AiContentDraftRow = Database["public"]["Tables"]["ai_content_drafts"]["Row"];
export type AiAutomationSuggestionRow = Database["public"]["Tables"]["ai_automation_suggestions"]["Row"];
export type AiObservabilityLogRow = Database["public"]["Tables"]["ai_observability_logs"]["Row"];
export type AiMemberRiskSummaryRow = Database["public"]["Views"]["ai_member_risk_summary"]["Row"];
export type AiOperationalSummaryRow = Database["public"]["Views"]["ai_operational_summary"]["Row"];

export type AiEvidence = {
  label: string;
  value: string | number;
  weight?: number;
};

export type AiRecommendedAction = {
  label: string;
  description: string;
  ownerRole: "admin" | "trainer" | "member" | "system";
  dueInDays?: number;
};

export type AiFitnessSignals = {
  attendanceLast30Days: number;
  workoutsLast30Days: number;
  classesBookedLast30Days: number;
  nutritionLogsLast7Days: number;
  activeGoals: number;
  currentStreak: number;
  daysSinceLastVisit: number | null;
  membershipDaysRemaining: number | null;
};

export type AiFitnessContext = {
  member: Pick<MemberRow, "id" | "gym_id" | "full_name" | "member_code" | "status" | "assigned_trainer_id">;
  trainer: Pick<TrainerRow, "id" | "display_name" | "status"> | null;
  goals: Array<{ title: string; goalType: string; status: string; progress: number }>;
  measurements: Array<{ date: string; weightKg: number | null; bodyFat: number | null; bmi: number | null }>;
  signals: AiFitnessSignals;
};

export type AiGeneratedRecommendation = {
  type: AiRecommendationType;
  title: string;
  summary: string;
  explanation: string;
  confidence: number;
  priority: "low" | "medium" | "high" | "urgent";
  evidence: AiEvidence[];
  actions: AiRecommendedAction[];
};

export type AiForecastPoint = {
  key: string;
  label: string;
  forecastValue: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  horizonDays: number;
  explanation: string;
};

export type AiDashboardMetric = {
  label: string;
  value: string;
  detail: string;
  status: "good" | "watch" | "risk";
};

export type MemberAiDashboard = {
  fitnessProfile: AiFitnessProfileRow | null;
  context: AiFitnessContext | null;
  recommendations: AiGeneratedRecommendation[];
  storedRecommendations: AiRecommendationRow[];
  progressInsight: AiInsightRow | null;
  chatSessions: AiChatSessionRow[];
};

export type TrainerAiDashboard = {
  trainer: Pick<TrainerRow, "id" | "display_name" | "status"> | null;
  riskMembers: AiMemberRiskSummaryRow[];
  recommendations: AiRecommendationRow[];
  programDrafts: AiGeneratedProgramRow[];
};

export type AdminAiDashboard = {
  metrics: AiDashboardMetric[];
  recommendations: AiRecommendationRow[];
  insights: AiInsightRow[];
  forecasts: AiForecastPoint[];
  riskMembers: AiMemberRiskSummaryRow[];
  contentDrafts: AiContentDraftRow[];
  automationSuggestions: AiAutomationSuggestionRow[];
  observability: {
    totalRequests: number;
    fallbackRate: number;
    averageLatencyMs: number;
    blockedRequests: number;
  };
};

export type AiJsonRecord = Record<string, Json>;
