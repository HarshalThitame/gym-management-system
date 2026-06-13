"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { AuthContext } from "@/types/auth";
import type { Json } from "@/types/database";
import { parseJsonObject } from "../lib/business-rules";
import { MarketingCampaignSchema, AnalyticsAlertSchema } from "../schemas/analytics";

export async function saveMarketingCampaignAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/super-admin/analytics");
  const parsed = MarketingCampaignSchema.safeParse({
    campaignId: formData.get("campaignId") ?? "",
    campaignName: formData.get("campaignName"),
    campaignType: formData.get("campaignType"),
    channel: formData.get("channel"),
    budget: formData.get("budget") ?? "0",
    spend: formData.get("spend") ?? "0",
    leadsGenerated: formData.get("leadsGenerated") ?? "0",
    conversions: formData.get("conversions") ?? "0",
    revenueGenerated: formData.get("revenueGenerated") ?? "0",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") ?? "",
    status: formData.get("status") ?? "active"
  });

  if (!parsed.success) {
    return { status: "error", message: "Validation failed.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await getSupabaseAdminClient();
  if (!supabase) return { status: "error", message: "Admin client unavailable." };
  const s = supabase as unknown as {
    from: (t: string) => {
      insert: (p: Record<string, unknown>) => Promise<{ error: unknown; data: unknown }>;
      update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown; data: unknown }> };
    }
  };

  const payload: Record<string, unknown> = {
    organization_id: scope.scopedOrganizationId ?? scope.organizationId ?? null,
    gym_id: scope.gymId,
    campaign_name: parsed.data.campaignName,
    campaign_type: parsed.data.campaignType,
    channel: parsed.data.channel,
    budget: parsed.data.budget,
    spend: parsed.data.spend,
    leads_generated: parsed.data.leadsGenerated,
    conversions: parsed.data.conversions,
    revenue_generated: parsed.data.revenueGenerated,
    roi: parsed.data.spend > 0 ? Math.round(((parsed.data.revenueGenerated - parsed.data.spend) / parsed.data.spend) * 100) : 0,
    cac: parsed.data.conversions > 0 ? Math.round(parsed.data.spend / parsed.data.conversions) : 0,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate || null,
    status: parsed.data.status,
    created_by: scope.userId
  };

  const rawResult: { error: unknown; data: unknown } = parsed.data.campaignId
    ? await s.from("analytics_marketing_campaigns").update(payload).eq("id", parsed.data.campaignId)
    : await s.from("analytics_marketing_campaigns").insert(payload);

  if (rawResult.error || !rawResult.data) {
    return { status: "error", message: (rawResult.error as { message?: string })?.message ?? "Campaign save failed." };
  }

  await writeEnterpriseAnalyticsAudit(scope, "marketing_campaign.saved", "analytics_marketing_campaign", ((rawResult.data as unknown[])![0] as { id: string })?.id ?? "unknown", { campaignName: parsed.data.campaignName });
  revalidateEnterpriseAnalyticsPaths();
  return { status: "success", message: parsed.data.campaignId ? "Campaign updated." : "Campaign created." };
}

export async function saveAnalyticsAlertAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/super-admin/analytics");
  const parsed = AnalyticsAlertSchema.safeParse({
    alertId: formData.get("alertId") ?? "",
    alertName: formData.get("alertName"),
    metricKey: formData.get("metricKey"),
    conditionType: formData.get("conditionType"),
    thresholdValue: formData.get("thresholdValue") ?? "0",
    comparisonPeriod: formData.get("comparisonPeriod") ?? "",
    severity: formData.get("severity") ?? "medium",
    channels: formData.get("channels") ?? '["email"]',
    slackWebhook: formData.get("slackWebhook") ?? "",
    teamsWebhook: formData.get("teamsWebhook") ?? "",
    webhookUrl: formData.get("webhookUrl") ?? "",
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    cooldownMinutes: formData.get("cooldownMinutes") ?? "60"
  });

  if (!parsed.success) {
    return { status: "error", message: "Validation failed.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const channels = parseJsonObject(parsed.data.channels || "");
  if (!channels.ok) return { status: "error", message: channels.message };

  const supabase = await getSupabaseAdminClient();
  if (!supabase) return { status: "error", message: "Admin client unavailable." };
  const s = supabase as unknown as {
    from: (t: string) => {
      insert: (p: Record<string, unknown>) => Promise<{ error: unknown; data: unknown }>;
      update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown; data: unknown }> };
    }
  };

  const payload: Record<string, unknown> = {
    organization_id: scope.scopedOrganizationId ?? scope.organizationId ?? null,
    gym_id: scope.gymId,
    alert_name: parsed.data.alertName,
    metric_key: parsed.data.metricKey,
    condition_type: parsed.data.conditionType,
    threshold_value: parsed.data.thresholdValue,
    comparison_period: parsed.data.comparisonPeriod || null,
    severity: parsed.data.severity,
    channels: channels.value,
    slack_webhook: parsed.data.slackWebhook || null,
    teams_webhook: parsed.data.teamsWebhook || null,
    webhook_url: parsed.data.webhookUrl || null,
    is_active: parsed.data.isActive,
    cooldown_minutes: parsed.data.cooldownMinutes,
    created_by: scope.userId
  };

  const rawAlertResult: { error: unknown; data: unknown } = parsed.data.alertId
    ? await s.from("analytics_alerts").update(payload).eq("id", parsed.data.alertId)
    : await s.from("analytics_alerts").insert(payload);

  if (rawAlertResult.error || !rawAlertResult.data) {
    return { status: "error", message: (rawAlertResult.error as { message?: string })?.message ?? "Alert save failed." };
  }

  await writeEnterpriseAnalyticsAudit(scope, "analytics_alert.saved", "analytics_alert", ((rawAlertResult.data as unknown[])![0] as { id: string })?.id ?? "unknown", { alertName: parsed.data.alertName });
  revalidateEnterpriseAnalyticsPaths();
  return { status: "success", message: parsed.data.alertId ? "Alert updated." : "Alert created." };
}

export async function dismissAlertHistoryAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/super-admin/analytics");
  const alertHistoryId = formData.get("alertHistoryId");
  if (!alertHistoryId || typeof alertHistoryId !== "string") {
    return { status: "error", message: "Invalid alert history ID." };
  }

  const supabase = await getSupabaseAdminClient();
  if (!supabase) return { status: "error", message: "Admin client unavailable." };
  const s = supabase as unknown as { from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } } };

  const dismissRaw: { error: unknown } = await s.from("analytics_alert_history").update({ resolved_at: new Date().toISOString() }).eq("id", alertHistoryId);
  if (dismissRaw.error) return { status: "error", message: (dismissRaw.error as { message?: string })?.message ?? "Dismiss failed." };

  await writeEnterpriseAnalyticsAudit(scope, "analytics_alert.dismissed", "analytics_alert_history", alertHistoryId, {});
  revalidateEnterpriseAnalyticsPaths();
  return { status: "success", message: "Alert dismissed." };
}

export async function toggleAlertAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const scope = await requireGymAdminScope("/super-admin/analytics");
  const alertId = formData.get("alertId");
  const isActive = formData.get("isActive") === "true";

  if (!alertId || typeof alertId !== "string") return { status: "error", message: "Invalid alert ID." };

  const supabase = await getSupabaseAdminClient();
  if (!supabase) return { status: "error", message: "Admin client unavailable." };
  const s = supabase as unknown as { from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } } };

  const toggleRaw: { error: unknown } = await s.from("analytics_alerts").update({ is_active: isActive }).eq("id", alertId);
  if (toggleRaw.error) return { status: "error", message: (toggleRaw.error as { message?: string })?.message ?? "Toggle failed." };

  await writeEnterpriseAnalyticsAudit(scope, "analytics_alert.toggled", "analytics_alert", alertId, { isActive });
  revalidateEnterpriseAnalyticsPaths();
  return { status: "success", message: isActive ? "Alert activated." : "Alert deactivated." };
}

async function writeEnterpriseAnalyticsAudit(context: AuthContext, action: string, entityType: string, entityId: string, metadata: Json = {}) {
  await writeAuditLog({
    actorId: context.userId,
    gymId: (context as AuthContext & { gymId?: string | null }).gymId ?? context.profile?.gym_id ?? null,
    action,
    entityType,
    entityId,
    metadata
  });
}

function revalidateEnterpriseAnalyticsPaths() {
  revalidatePath("/super-admin/analytics");
  revalidatePath("/admin/reports");
}
