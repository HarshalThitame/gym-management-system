import type { Database, Json } from "./database";

export const analyticsCategories = ["revenue", "membership", "attendance", "trainer", "class", "fitness", "retention", "sales", "operations"] as const;
export const reportCategories = ["financial", "membership", "attendance", "trainer", "class", "fitness", "sales", "retention", "operations"] as const;
export const reportFormats = ["csv", "excel", "pdf"] as const;
export const dashboardScopes = ["private", "role", "gym"] as const;
export const forecastModelTypes = ["moving_average", "linear_trend", "seasonal_baseline", "manual"] as const;
export const insightSeverities = ["low", "medium", "high", "critical"] as const;
export const insightStatuses = ["open", "acknowledged", "resolved", "dismissed"] as const;

export const analyticsReportKeys = [
  "executive_kpi_snapshot",
  "revenue_sources",
  "membership_retention",
  "attendance_engagement",
  "trainer_scorecard",
  "class_utilization",
  "fitness_outcomes",
  "sales_funnel"
] as const;

export type AnalyticsCategory = (typeof analyticsCategories)[number];
export type AnalyticsReportCategory = (typeof reportCategories)[number];
export type AnalyticsReportFormat = (typeof reportFormats)[number];
export type AnalyticsReportKey = (typeof analyticsReportKeys)[number];

export type AnalyticsEventRow = Database["public"]["Tables"]["analytics_events"]["Row"];
export type KpiSnapshotRow = Database["public"]["Tables"]["kpi_snapshots"]["Row"];
export type DashboardConfigRow = Database["public"]["Tables"]["dashboard_configs"]["Row"];
export type SavedReportRow = Database["public"]["Tables"]["saved_reports"]["Row"];
export type ReportExportRow = Database["public"]["Tables"]["report_exports"]["Row"];
export type ForecastModelRow = Database["public"]["Tables"]["forecast_models"]["Row"];
export type BusinessMetricRow = Database["public"]["Tables"]["business_metrics"]["Row"];
export type AnalyticsInsightRow = Database["public"]["Tables"]["analytics_insights"]["Row"];
export type AnalyticsRevenueDailyRow = Database["public"]["Views"]["analytics_revenue_daily"]["Row"];
export type AnalyticsMembershipDailyRow = Database["public"]["Views"]["analytics_membership_daily"]["Row"];
export type AnalyticsLeadFunnelRow = Database["public"]["Views"]["analytics_lead_funnel"]["Row"];

export type KpiCard = {
  key: string;
  label: string;
  category: AnalyticsCategory;
  value: string;
  numericValue: number;
  detail: string;
  comparisonLabel: string;
  changePercentage: number;
  status: "good" | "watch" | "risk";
};

export type RevenueTrendPoint = {
  date: string;
  revenue: number;
  membership: number;
  renewal: number;
  personalTraining: number;
  classes: number;
};

export type MembershipTrendPoint = {
  date: string;
  newMembers: number;
  renewals: number;
  expired: number;
};

export type AttendanceHeatmapPoint = {
  day: string;
  hour: string;
  visits: number;
};

export type TrainerScorecard = {
  trainerId: string;
  trainerName: string;
  assignedMembers: number;
  completedSessions: number;
  scheduledSessions: number;
  completionRate: number;
  ptRevenue: number;
  averageRating: number;
  utilizationScore: number;
};

export type ClassScorecard = {
  className: string;
  sessions: number;
  fillRate: number;
  booked: number;
  capacity: number;
  waitlist: number;
};

export type FitnessOutcomePoint = {
  label: string;
  value: number;
  detail: string;
};

export type LeadFunnelPoint = {
  source: string;
  status: string;
  leads: number;
  conversionRate: number;
};

export type ForecastPoint = {
  metricKey: string;
  label: string;
  forecastValue: number;
  confidence: "baseline" | "medium" | "low";
  horizonDays: number;
};

export type AnalyticsReportRow = Record<string, string | number | null>;

export type AnalyticsReportPayload = {
  key: AnalyticsReportKey;
  category: AnalyticsReportCategory;
  title: string;
  generatedAt: string;
  headers: string[];
  rows: AnalyticsReportRow[];
};

export type ExecutiveAnalyticsDashboard = {
  kpis: KpiCard[];
  revenueTrend: RevenueTrendPoint[];
  revenueSources: Array<{ source: string; amount: number; percentage: number }>;
  membershipTrend: MembershipTrendPoint[];
  planPopularity: Array<{ plan: string; members: number; revenue: number }>;
  attendanceTrend: Array<{ date: string; visits: number; uniqueMembers: number }>;
  attendanceHeatmap: AttendanceHeatmapPoint[];
  trainerScorecards: TrainerScorecard[];
  classScorecards: ClassScorecard[];
  fitnessOutcomes: FitnessOutcomePoint[];
  leadFunnel: LeadFunnelPoint[];
  retention: {
    retentionRate: number;
    churnRate: number;
    inactiveMembers: number;
    estimatedLifetimeValue: number;
    churnRiskMembers: number;
  };
  forecasts: ForecastPoint[];
  insights: AnalyticsInsightRow[];
  savedReports: SavedReportRow[];
  reportExports: ReportExportRow[];
  dashboardConfigs: DashboardConfigRow[];
  forecastModels: ForecastModelRow[];
  businessMetrics: BusinessMetricRow[];
};

export type JsonRecord = Record<string, Json>;
