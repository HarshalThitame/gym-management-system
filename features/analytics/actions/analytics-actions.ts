"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext } from "@/types/auth";
import type { Json } from "@/types/database";
import { parseJsonArray, parseJsonObject } from "../lib/business-rules";
import {
  AnalyticsEventSchema,
  DashboardConfigSchema,
  ForecastModelSchema,
  InsightStatusSchema,
  ReportExportSchema,
  SavedReportSchema
} from "../schemas/analytics";

export async function saveDashboardConfigAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/admin/reports");
  const context = scope;
  const parsed = DashboardConfigSchema.safeParse({
    dashboardConfigId: formData.get("dashboardConfigId") ?? "",
    name: formData.get("name"),
    roleName: formData.get("roleName") ?? context.primaryRole ?? "gym_admin",
    scope: formData.get("scope") ?? "private",
    layout: formData.get("layout") ?? "",
    widgets: formData.get("widgets") ?? "",
    isDefault: checkbox(formData, "isDefault")
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const layout = parseJsonArray(parsed.data.layout || "");
  if (!layout.ok) {
    return { status: "error", message: layout.message, fieldErrors: { layout: [layout.message] } };
  }
  const widgets = parseJsonArray(parsed.data.widgets || "");
  if (!widgets.ok) {
    return { status: "error", message: widgets.message, fieldErrors: { widgets: [widgets.message] } };
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    gym_id: scope.gymId,
    user_id: parsed.data.scope === "private" ? scope.userId : null,
    role_name: parsed.data.roleName,
    name: parsed.data.name,
    scope: parsed.data.scope,
    layout: layout.value,
    widgets: widgets.value,
    is_default: parsed.data.isDefault,
    created_by: scope.userId
  };
  const result = parsed.data.dashboardConfigId
    ? await supabase.from("dashboard_configs").update(payload).eq("id", parsed.data.dashboardConfigId).select("*").maybeSingle()
    : await supabase.from("dashboard_configs").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Dashboard layout save failed." };
  }

  await writeAnalyticsAudit(context, parsed.data.dashboardConfigId ? "dashboard_config.updated" : "dashboard_config.created", "dashboard_config", result.data.id, { scope: parsed.data.scope });
  revalidateAnalyticsPaths();
  return { status: "success", message: parsed.data.dashboardConfigId ? "Dashboard layout updated." : "Dashboard layout saved." };
}

export async function saveSavedReportAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/admin/reports");
  const context = scope;
  const parsed = SavedReportSchema.safeParse({
    savedReportId: formData.get("savedReportId") ?? "",
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    reportKey: formData.get("reportKey"),
    filters: formData.get("filters") ?? "",
    columns: formData.get("columns") ?? "",
    visibility: formData.get("visibility") ?? "gym",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const filters = parseJsonObject(parsed.data.filters || "");
  if (!filters.ok) {
    return { status: "error", message: filters.message, fieldErrors: { filters: [filters.message] } };
  }
  const columns = parseJsonArray(parsed.data.columns || "");
  if (!columns.ok) {
    return { status: "error", message: columns.message, fieldErrors: { columns: [columns.message] } };
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    gym_id: scope.gymId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    category: parsed.data.category,
    report_key: parsed.data.reportKey,
    filters: filters.value,
    columns: columns.value,
    visibility: parsed.data.visibility,
    status: parsed.data.status,
    created_by: scope.userId
  };
  const result = parsed.data.savedReportId
    ? await supabase.from("saved_reports").update(payload).eq("id", parsed.data.savedReportId).select("*").maybeSingle()
    : await supabase.from("saved_reports").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Report save failed." };
  }

  await writeAnalyticsAudit(context, parsed.data.savedReportId ? "saved_report.updated" : "saved_report.created", "saved_report", result.data.id, { reportKey: parsed.data.reportKey });
  revalidateAnalyticsPaths();
  return { status: "success", message: parsed.data.savedReportId ? "Saved report updated." : "Saved report created." };
}

export async function queueReportExportAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/admin/reports");
  const context = scope;
  const parsed = ReportExportSchema.safeParse({
    savedReportId: formData.get("savedReportId") ?? "",
    reportKey: formData.get("reportKey"),
    category: formData.get("category"),
    format: formData.get("format") ?? "csv",
    from: formData.get("from") ?? "",
    to: formData.get("to") ?? "",
    status: formData.get("status") ?? "",
    trainerId: formData.get("trainerId") ?? "",
    memberId: formData.get("memberId") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const filters = {
    from: parsed.data.from || null,
    to: parsed.data.to || null,
    status: parsed.data.status || null,
    trainerId: parsed.data.trainerId || null,
    memberId: parsed.data.memberId || null
  };
  const { data, error } = await supabase.from("report_exports").insert({
    gym_id: scope.gymId,
    saved_report_id: parsed.data.savedReportId || null,
    report_key: parsed.data.reportKey,
    category: parsed.data.category,
    format: parsed.data.format,
    status: "queued",
    filters: filters as Json,
    requested_by: scope.userId
  }).select("*").maybeSingle();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Export queue failed." };
  }

  await writeAnalyticsAudit(context, "report_export.queued", "report_export", data.id, { reportKey: parsed.data.reportKey, format: parsed.data.format });
  revalidateAnalyticsPaths();
  return { status: "success", message: "Report export queued. Use the download buttons for immediate exports." };
}

export async function saveForecastModelAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/admin/reports");
  const context = scope;
  const parsed = ForecastModelSchema.safeParse({
    forecastModelId: formData.get("forecastModelId") ?? "",
    name: formData.get("name"),
    metricKey: formData.get("metricKey"),
    modelType: formData.get("modelType") ?? "moving_average",
    horizonDays: formData.get("horizonDays") ?? "30",
    trainingWindowDays: formData.get("trainingWindowDays") ?? "180",
    parameters: formData.get("parameters") ?? "",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const parameters = parseJsonObject(parsed.data.parameters || "");
  if (!parameters.ok) {
    return { status: "error", message: parameters.message, fieldErrors: { parameters: [parameters.message] } };
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    gym_id: scope.gymId,
    name: parsed.data.name,
    metric_key: parsed.data.metricKey,
    model_type: parsed.data.modelType,
    horizon_days: parsed.data.horizonDays,
    training_window_days: parsed.data.trainingWindowDays,
    parameters: parameters.value,
    status: parsed.data.status,
    created_by: scope.userId
  };
  const result = parsed.data.forecastModelId
    ? await supabase.from("forecast_models").update(payload).eq("id", parsed.data.forecastModelId).select("*").maybeSingle()
    : await supabase.from("forecast_models").insert(payload).select("*").maybeSingle();

  if (result.error || !result.data) {
    return { status: "error", message: result.error?.message ?? "Forecast model save failed." };
  }

  await writeAnalyticsAudit(context, parsed.data.forecastModelId ? "forecast_model.updated" : "forecast_model.created", "forecast_model", result.data.id, { metricKey: parsed.data.metricKey });
  revalidateAnalyticsPaths();
  return { status: "success", message: parsed.data.forecastModelId ? "Forecast model updated." : "Forecast model created." };
}

export async function updateInsightStatusAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/admin/reports");
  const context = scope;
  const parsed = InsightStatusSchema.safeParse({
    insightId: formData.get("insightId"),
    status: formData.get("status") ?? "acknowledged"
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("analytics_insights").update({
    status: parsed.data.status,
    resolved_at: parsed.data.status === "resolved" || parsed.data.status === "dismissed" ? new Date().toISOString() : null
  }).eq("id", parsed.data.insightId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeAnalyticsAudit(context, "analytics_insight.status_changed", "analytics_insight", parsed.data.insightId, { status: parsed.data.status });
  revalidateAnalyticsPaths();
  return { status: "success", message: "Insight status updated." };
}

export async function captureAnalyticsEventAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/admin/reports");
  const parsed = AnalyticsEventSchema.safeParse({
    eventName: formData.get("eventName"),
    entityType: formData.get("entityType") ?? "",
    entityId: formData.get("entityId") ?? "",
    source: formData.get("source") ?? "admin",
    properties: formData.get("properties") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const properties = parseJsonObject(parsed.data.properties || "");
  if (!properties.ok) {
    return { status: "error", message: properties.message, fieldErrors: { properties: [properties.message] } };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("analytics_events").insert({
    gym_id: scope.gymId,
    actor_id: scope.userId,
    event_name: parsed.data.eventName,
    entity_type: parsed.data.entityType || null,
    entity_id: parsed.data.entityId || null,
    source: parsed.data.source,
    properties: properties.value
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidateAnalyticsPaths();
  return { status: "success", message: "Analytics event recorded." };
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

async function writeAnalyticsAudit(context: AuthContext, action: string, entityType: string, entityId: string, metadata: Json = {}) {
  await writeAuditLog({
    actorId: context.userId,
    gymId: getContextGymId(context),
    action,
    entityType,
    entityId,
    metadata
  });
}

function getContextGymId(context: AuthContext) {
  return (context as AuthContext & { gymId?: string | null }).gymId ?? context.profile?.gym_id ?? null;
}

function revalidateAnalyticsPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/trainer");
  revalidatePath("/member");
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, value]) => value && value.length > 0)) as Record<string, string[]>
  };
}
