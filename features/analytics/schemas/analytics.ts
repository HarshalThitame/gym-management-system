import { z } from "zod";
import { analyticsReportKeys, dashboardScopes, forecastModelTypes, insightStatuses, reportCategories, reportFormats } from "@/types/analytics";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));
const jsonText = z.string().trim().max(8000).optional().or(z.literal(""));

export const DashboardConfigSchema = z.object({
  dashboardConfigId: optionalUuid,
  name: z.string().trim().min(2).max(120),
  roleName: z.enum(["super_admin", "organization_owner", "gym_admin", "reception_staff", "trainer", "member"]),
  scope: z.enum(dashboardScopes),
  layout: jsonText,
  widgets: jsonText,
  isDefault: z.coerce.boolean()
});

export const SavedReportSchema = z.object({
  savedReportId: optionalUuid,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  category: z.enum(reportCategories),
  reportKey: z.enum(analyticsReportKeys),
  filters: jsonText,
  columns: jsonText,
  visibility: z.enum(["private", "role", "gym"]),
  status: z.enum(["active", "archived"])
});

export const ReportExportSchema = z.object({
  savedReportId: optionalUuid,
  reportKey: z.enum(analyticsReportKeys),
  category: z.enum(reportCategories),
  format: z.enum(reportFormats),
  from: z.string().optional().or(z.literal("")),
  to: z.string().optional().or(z.literal("")),
  status: z.string().optional().or(z.literal("")),
  trainerId: optionalUuid,
  memberId: optionalUuid
});

export const ForecastModelSchema = z.object({
  forecastModelId: optionalUuid,
  name: z.string().trim().min(2).max(160),
  metricKey: z.string().trim().min(2).max(120),
  modelType: z.enum(forecastModelTypes),
  horizonDays: z.coerce.number().int().min(1).max(730),
  trainingWindowDays: z.coerce.number().int().min(7).max(1825),
  parameters: jsonText,
  status: z.enum(["active", "paused", "archived"])
});

export const InsightStatusSchema = z.object({
  insightId: z.string().uuid(),
  status: z.enum(insightStatuses)
});

export const AnalyticsEventSchema = z.object({
  eventName: z.string().trim().min(2).max(120),
  entityType: z.string().trim().max(80).optional().or(z.literal("")),
  entityId: optionalUuid,
  source: z.enum(["system", "admin", "trainer", "member", "public", "automation", "import"]),
  properties: jsonText
});

export const AnalyticsFilterSchema = z.object({
  dateRange: z.object({ from: z.string(), to: z.string() }).optional(),
  fiscalYear: z.string().optional(),
  branchId: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  tenantId: z.string().optional(),
  organizationId: z.string().optional(),
  membershipPlanId: z.string().optional(),
  trainerId: z.string().optional(),
  customerSegment: z.string().optional(),
  revenueSource: z.string().optional(),
  marketingChannel: z.string().optional(),
  deviceType: z.string().optional()
});

export const MarketingCampaignSchema = z.object({
  campaignId: optionalUuid,
  campaignName: z.string().trim().min(2).max(200),
  campaignType: z.enum(["google_ads", "meta_ads", "instagram", "whatsapp", "referral", "influencer", "organic", "email", "other"]),
  channel: z.string().trim().min(2).max(80),
  budget: z.coerce.number().min(0),
  spend: z.coerce.number().min(0),
  leadsGenerated: z.coerce.number().int().min(0),
  conversions: z.coerce.number().int().min(0),
  revenueGenerated: z.coerce.number().min(0),
  startDate: z.string(),
  endDate: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "paused", "completed", "archived"])
});

export const AnalyticsAlertSchema = z.object({
  alertId: optionalUuid,
  alertName: z.string().trim().min(2).max(160),
  metricKey: z.string().trim().min(2).max(120),
  conditionType: z.enum(["threshold_above", "threshold_below", "percentage_change", "anomaly_detection"]),
  thresholdValue: z.coerce.number(),
  comparisonPeriod: z.enum(["previous_day", "previous_week", "previous_month", "same_period_last_year"]).optional().or(z.literal("")),
  severity: z.enum(["low", "medium", "high", "critical"]),
  channels: jsonText,
  slackWebhook: z.string().optional().or(z.literal("")),
  teamsWebhook: z.string().optional().or(z.literal("")),
  webhookUrl: z.string().optional().or(z.literal("")),
  isActive: z.coerce.boolean(),
  cooldownMinutes: z.coerce.number().int().min(1).max(1440)
});

export type SavedReportInput = z.infer<typeof SavedReportSchema>;
export type ReportExportInput = z.infer<typeof ReportExportSchema>;
export type AnalyticsFilterInput = z.infer<typeof AnalyticsFilterSchema>;
export type MarketingCampaignInput = z.infer<typeof MarketingCampaignSchema>;
export type AnalyticsAlertInput = z.infer<typeof AnalyticsAlertSchema>;
