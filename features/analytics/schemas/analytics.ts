import { z } from "zod";
import { analyticsReportKeys, dashboardScopes, forecastModelTypes, insightStatuses, reportCategories, reportFormats } from "@/types/analytics";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));
const jsonText = z.string().trim().max(8000).optional().or(z.literal(""));

export const DashboardConfigSchema = z.object({
  dashboardConfigId: optionalUuid,
  name: z.string().trim().min(2).max(120),
  roleName: z.enum(["super_admin", "gym_admin", "reception_staff", "trainer", "member"]),
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

export type SavedReportInput = z.infer<typeof SavedReportSchema>;
export type ReportExportInput = z.infer<typeof ReportExportSchema>;
