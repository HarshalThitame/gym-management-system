"use server";

import { revalidatePath } from "next/cache";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { writeAuditLog } from "@/lib/audit";
import {
  getEvents,
  getEventStats,
  getFunnelConversion,
  getEventTimeline,
  createFunnel,
  getFunnels,
  createReport,
  getReports,
} from "../services/analytics-service";

export async function getEventsAction(eventType?: string) {
  const scope = await requireGymAdminScope("/admin/analytics");
  return getEvents(scope.scopedOrganizationId ?? scope.organizationId, { event_type: eventType });
}

export async function getEventStatsAction() {
  const scope = await requireGymAdminScope("/admin/analytics");
  return getEventStats(scope.scopedOrganizationId ?? scope.organizationId);
}

export async function getFunnelConversionAction(steps: { name: string; event_type: string; event_name: string }[]) {
  const scope = await requireGymAdminScope("/admin/analytics");
  return getFunnelConversion(scope.scopedOrganizationId ?? scope.organizationId, steps);
}

export async function getEventTimelineAction(days?: number) {
  const scope = await requireGymAdminScope("/admin/analytics");
  return getEventTimeline(scope.scopedOrganizationId ?? scope.organizationId, days);
}

export async function createFunnelAction(formData: FormData): Promise<void> {
  const scope = await requireGymAdminScope("/admin/analytics");
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const stepsRaw = formData.get("steps") as string;

  if (!name) return;

  try {
    await createFunnel({
      organization_id: scope.scopedOrganizationId ?? scope.organizationId,
      name,
      description,
      steps: stepsRaw ? JSON.parse(stepsRaw) : [],
      created_by: scope.userId,
    });
    await writeAuditLog({ actorId: scope.userId, action: "analytics.funnel_created", entityType: "analytics_funnel" });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/analytics");
}

export async function createReportAction(formData: FormData): Promise<void> {
  const scope = await requireGymAdminScope("/admin/analytics");
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const reportType = formData.get("reportType") as string;
  const configRaw = formData.get("config") as string;

  if (!name || !reportType) return;

  try {
    await createReport({
      organization_id: scope.scopedOrganizationId ?? scope.organizationId,
      name,
      description,
      report_type: reportType as "dashboard" | "funnel" | "cohort" | "custom" | "export",
      config: configRaw ? JSON.parse(configRaw) : {},
      created_by: scope.userId,
    });
    await writeAuditLog({ actorId: scope.userId, action: "analytics.report_created", entityType: "analytics_report" });
  } catch {
    // Silently fail
  }

  revalidatePath("/admin/analytics");
}

export async function getFunnelsAction() {
  const scope = await requireGymAdminScope("/admin/analytics");
  return getFunnels(scope.scopedOrganizationId ?? scope.organizationId);
}

export async function getReportsAction() {
  const scope = await requireGymAdminScope("/admin/analytics");
  return getReports(scope.scopedOrganizationId ?? scope.organizationId);
}
