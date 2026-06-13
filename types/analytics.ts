import type { Database, Json } from "./database";

export const analyticsCategories = ["revenue", "membership", "attendance", "trainer", "class", "fitness", "retention", "sales", "operations", "marketing", "capacity", "behavior"] as const;
export const reportCategories = ["financial", "membership", "attendance", "trainer", "class", "fitness", "sales", "retention", "operations"] as const;
export const reportFormats = ["csv", "excel", "pdf"] as const;
export const dashboardScopes = ["private", "role", "gym"] as const;
export const forecastModelTypes = ["moving_average", "linear_trend", "seasonal_baseline", "manual"] as const;
export const insightSeverities = ["low", "medium", "high", "critical"] as const;
export const insightStatuses = ["open", "acknowledged", "resolved", "dismissed"] as const;
export const cohortPeriods = ["monthly", "quarterly", "yearly"] as const;
export const ltvSegments = ["high_value", "medium_value", "at_risk", "vip", "champion", "new"] as const;
export const churnRiskCategories = ["low", "medium", "high", "critical"] as const;
export const attributionModels = ["first_touch", "last_touch", "linear", "position_based", "time_decay"] as const;
export const campaignTypes = ["google_ads", "meta_ads", "instagram", "whatsapp", "referral", "influencer", "organic", "email", "other"] as const;
export const alertConditionTypes = ["threshold_above", "threshold_below", "percentage_change", "anomaly_detection"] as const;
export const alertSeverities = ["low", "medium", "high", "critical"] as const;
export const alertChannels = ["email", "sms", "whatsapp", "push", "slack", "teams", "webhook"] as const;
export const forecastScenarios = ["best_case", "expected_case", "worst_case", "custom"] as const;
export const behaviorSegments = ["active", "highly_engaged", "casual", "at_risk", "inactive"] as const;

export const analyticsReportKeys = [
  "executive_kpi_snapshot",
  "revenue_sources",
  "membership_retention",
  "attendance_engagement",
  "trainer_scorecard",
  "class_utilization",
  "fitness_outcomes",
  "sales_funnel",
  "revenue_intelligence",
  "membership_cohorts",
  "churn_analysis",
  "ltv_analysis",
  "branch_scorecard",
  "trainer_performance",
  "marketing_attribution",
  "capacity_utilization",
  "behavior_engagement",
  "forecast_scenario"
] as const;

export type AnalyticsCategory = (typeof analyticsCategories)[number];
export type AnalyticsReportCategory = (typeof reportCategories)[number];
export type AnalyticsReportFormat = (typeof reportFormats)[number];
export type AnalyticsReportKey = (typeof analyticsReportKeys)[number];
export type CohortPeriod = (typeof cohortPeriods)[number];
export type LtvSegment = (typeof ltvSegments)[number];
export type ChurnRiskCategory = (typeof churnRiskCategories)[number];
export type AttributionModel = (typeof attributionModels)[number];
export type CampaignType = (typeof campaignTypes)[number];
export type AlertConditionType = (typeof alertConditionTypes)[number];
export type AlertSeverity = (typeof alertSeverities)[number];
export type AlertChannel = (typeof alertChannels)[number];
export type ForecastScenario = (typeof forecastScenarios)[number];
export type BehaviorSegment = (typeof behaviorSegments)[number];

export type AnalyticsEventRow = Database["public"]["Tables"]["analytics_events"]["Row"];
export type KpiSnapshotRow = Database["public"]["Tables"]["kpi_snapshots"]["Row"];
export type DashboardConfigRow = Database["public"]["Tables"]["dashboard_configs"]["Row"];
export type SavedReportRow = Database["public"]["Tables"]["saved_reports"]["Row"];
export type ReportExportRow = Database["public"]["Tables"]["report_exports"]["Row"];
export type ForecastModelRow = Database["public"]["Tables"]["forecast_models"]["Row"];
export type BusinessMetricRow = Database["public"]["Tables"]["business_metrics"]["Row"];
export type AnalyticsInsightRow = Database["public"]["Tables"]["analytics_insights"]["Row"];
export type AnalyticsCohortRow = Database["public"]["Tables"]["analytics_cohorts"]["Row"];
export type MarketingCampaignRow = Database["public"]["Tables"]["analytics_marketing_campaigns"]["Row"];
export type MarketingAttributionRow = Database["public"]["Tables"]["analytics_marketing_attribution"]["Row"];
export type ChurnPredictionRow = Database["public"]["Tables"]["analytics_churn_predictions"]["Row"];
export type AnalyticsAlertRow = Database["public"]["Tables"]["analytics_alerts"]["Row"];
export type AnalyticsAlertHistoryRow = Database["public"]["Tables"]["analytics_alert_history"]["Row"];
export type AnalyticsLtvSnapshotRow = Database["public"]["Tables"]["analytics_ltv_snapshots"]["Row"];
export type AnalyticsBranchScorecardRow = Database["public"]["Tables"]["analytics_branch_scorecards"]["Row"];

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
  retentionImpact?: number;
  customerSatisfaction?: number;
  upsellPerformance?: number;
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

export type MembershipCohortPoint = {
  cohortDate: string;
  cohortPeriod: CohortPeriod;
  memberCount: number;
  retentionDay7: number;
  retentionDay30: number;
  retentionDay90: number;
  retentionAnnual: number | null;
  churnRate: number;
  revenueContributed: number;
  lifetimeValue: number;
};

export type ChurnAnalysisPoint = {
  period: string;
  churnRate: number;
  churnedMembers: number;
  totalMembers: number;
  branchName?: string;
  trainerName?: string;
  planName?: string;
};

export type LtvSegmentPoint = {
  segment: LtvSegment;
  memberCount: number;
  currentLtv: number;
  predictedLtv: number;
  revenueContributed: number;
  retentionMonths: number;
  upgradeLikelihood: number;
};

export type BranchScorecardPoint = {
  branchId: string;
  branchName: string;
  organizationName: string;
  revenue: number;
  growthRate: number;
  profitability: number;
  membershipGrowth: number;
  retentionRate: number;
  trainerUtilization: number;
  capacityUtilization: number;
  memberCount: number;
  newMembers: number;
  churnedMembers: number;
  rank: number;
};

export type TrainerPerformancePoint = {
  trainerId: string;
  trainerName: string;
  sessionsDelivered: number;
  revenueGenerated: number;
  retentionImpact: number;
  attendanceRate: number;
  customerSatisfaction: number;
  upsellPerformance: number;
  rank: number;
};

export type CampaignPerformancePoint = {
  campaignId: string;
  campaignName: string;
  campaignType: CampaignType;
  channel: string;
  budget: number;
  spend: number;
  leadsGenerated: number;
  conversions: number;
  revenueGenerated: number;
  roi: number;
  cac: number;
  status: string;
};

export type MarketingChannelPoint = {
  channel: string;
  leads: number;
  conversions: number;
  revenue: number;
  cac: number;
  roi: number;
};

export type CapacityUtilizationPoint = {
  branchId: string;
  branchName: string;
  occupancyRate: number;
  peakHour: string;
  equipmentUtilization: number;
  studioUtilization: number;
  trainerUtilization: number;
  overcrowdingRisk: "low" | "medium" | "high";
};

export type BehaviorSegmentPoint = {
  segment: BehaviorSegment;
  memberCount: number;
  checkInFrequency: number;
  classAttendance: number;
  appUsage: number;
  rewardParticipation: number;
  revenueContribution: number;
};

export type JourneyStagePoint = {
  stage: string;
  count: number;
  conversionRate: number;
  dropOffRate: number;
};

export type ForecastScenarioPoint = {
  scenario: ForecastScenario;
  label: string;
  revenueProjections: Array<{ date: string; value: number }>;
  membershipProjections: Array<{ date: string; value: number }>;
  confidence: number;
};

export type EnterpriseAnalyticsDashboard = {
  kpis: KpiCard[];
  executiveSummary: {
    totalRevenue: number;
    mrr: number;
    arr: number;
    activeMembers: number;
    newMembers: number;
    churnRate: number;
    retentionRate: number;
    lifetimeValue: number;
    arpm: number;
    cac: number;
    nrr: number;
    expansionRevenue: number;
    refundRate: number;
    occupancyUtilization: number;
    branchPerformanceIndex: number;
  };
  revenueTrend: RevenueTrendPoint[];
  revenueSources: Array<{ source: string; amount: number; percentage: number }>;
  revenueIntelligence: {
    mrr: number;
    arr: number;
    deferredRevenue: number;
    collectedRevenue: number;
    outstandingRevenue: number;
    refundRevenue: number;
    expansionRevenue: number;
    upgradeRevenue: number;
    downgradeRevenue: number;
    revenueByTenant: Array<{ name: string; amount: number }>;
    revenueByBranch: Array<{ name: string; amount: number }>;
    revenueByRegion: Array<{ name: string; amount: number }>;
    revenueByPlan: Array<{ name: string; amount: number }>;
    revenueByService: Array<{ name: string; amount: number }>;
    revenueBySource: Array<{ name: string; amount: number }>;
  };
  membershipTrend: MembershipTrendPoint[];
  membershipAnalytics: {
    activeMemberships: number;
    newMemberships: number;
    renewals: number;
    freezes: number;
    expirations: number;
    cancellations: number;
    cohorts: MembershipCohortPoint[];
    planPopularity: Array<{ plan: string; members: number; revenue: number }>;
  };
  retention: {
    retentionRate: number;
    churnRate: number;
    inactiveMembers: number;
    estimatedLifetimeValue: number;
    churnRiskMembers: number;
    day7Retention: number;
    day30Retention: number;
    day90Retention: number;
    annualRetention: number;
    churnTrends: ChurnAnalysisPoint[];
    churnByBranch: ChurnAnalysisPoint[];
    churnByPlan: ChurnAnalysisPoint[];
    churnPrediction: ChurnPredictionRow[];
  };
  ltvAnalytics: {
    currentLtv: number;
    predictedLtv: number;
    averageLtv: number;
    segments: LtvSegmentPoint[];
    segmentRevenue: Array<{ segment: string; amount: number }>;
  };
  attendanceTrend: Array<{ date: string; visits: number; uniqueMembers: number }>;
  attendanceHeatmap: AttendanceHeatmapPoint[];
  trainerScorecards: TrainerScorecard[];
  trainerPerformance: TrainerPerformancePoint[];
  classScorecards: ClassScorecard[];
  fitnessOutcomes: FitnessOutcomePoint[];
  leadFunnel: LeadFunnelPoint[];
  branchScorecards: BranchScorecardPoint[];
  branchRanking: {
    topPerformers: BranchScorecardPoint[];
    underperformers: BranchScorecardPoint[];
    growthLeaders: BranchScorecardPoint[];
  };
  marketingAnalytics: {
    campaigns: CampaignPerformancePoint[];
    channelAnalysis: MarketingChannelPoint[];
    attribution: MarketingAttributionRow[];
    totalLeads: number;
    totalConversions: number;
    totalRevenue: number;
    totalCac: number;
    totalRoi: number;
  };
  capacityAnalytics: {
    occupancyRates: CapacityUtilizationPoint[];
    peakHours: Array<{ hour: string; occupancy: number }>;
    overcrowdingRisk: Array<{ branchName: string; risk: string }>;
  };
  behaviorAnalytics: {
    segments: BehaviorSegmentPoint[];
    journey: JourneyStagePoint[];
    engagementTrend: Array<{ date: string; activeUsers: number; engagement: number }>;
  };
  forecasts: ForecastPoint[];
  forecastScenarios: ForecastScenarioPoint[];
  alerts: AnalyticsAlertRow[];
  alertHistory: AnalyticsAlertHistoryRow[];
  insights: AnalyticsInsightRow[];
  savedReports: SavedReportRow[];
  reportExports: ReportExportRow[];
  dashboardConfigs: DashboardConfigRow[];
  forecastModels: ForecastModelRow[];
  businessMetrics: BusinessMetricRow[];
};

export type DrillDownLevel = "platform" | "tenant" | "organization" | "region" | "city" | "branch" | "trainer" | "membership_plan" | "customer";

export type DrillDownContext = {
  level: DrillDownLevel;
  tenantId?: string;
  organizationId?: string;
  region?: string;
  city?: string;
  branchId?: string;
  trainerId?: string;
  planId?: string;
  customerId?: string;
};

export type AnalyticsFilter = {
  dateRange?: { from: string; to: string };
  fiscalYear?: string;
  branchId?: string;
  region?: string;
  country?: string;
  tenantId?: string;
  organizationId?: string;
  membershipPlanId?: string;
  trainerId?: string;
  customerSegment?: string;
  revenueSource?: string;
  marketingChannel?: string;
  deviceType?: string;
};

export type SavedFilterPreset = {
  id: string;
  name: string;
  filters: AnalyticsFilter;
};

export type JsonRecord = Record<string, Json>;

export type ExecutiveAnalyticsDashboard = EnterpriseAnalyticsDashboard;
