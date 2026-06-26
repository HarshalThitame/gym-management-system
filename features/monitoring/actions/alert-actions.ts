"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { saveAlertConfig, testSlackWebhook, testPagerDuty, acknowledgeAlert, getAlertConfig, getAlertHistory } from "@/features/monitoring/services/alert-service";
import type { AlertConfig, AlertHistoryEntry } from "@/features/monitoring/services/alert-service";

type ActionResult = { status: "success" | "error"; message: string };

export async function saveAlertConfigAction(config: AlertConfig): Promise<ActionResult> {
  try {
    await requireRole(["super_admin"], "/super-admin/monitoring");
    const result = await saveAlertConfig(config);
    if (!result.success) {
      return { status: "error", message: result.error ?? "Failed to save alert config" };
    }
    revalidatePath("/super-admin/monitoring");
    return { status: "success", message: "Alert configuration saved successfully" };
  } catch (err: any) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    return { status: "error", message: err.message ?? "Failed to save alert configuration" };
  }
}

export async function testSlackWebhookAction(webhookUrl: string): Promise<ActionResult> {
  try {
    await requireRole(["super_admin"], "/super-admin/monitoring");
    const result = await testSlackWebhook(webhookUrl);
    return { status: result.success ? "success" : "error", message: result.message };
  } catch (err: any) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    return { status: "error", message: err.message ?? "Failed to test Slack webhook" };
  }
}

export async function testPagerDutyAction(integrationKey: string): Promise<ActionResult> {
  try {
    await requireRole(["super_admin"], "/super-admin/monitoring");
    const result = await testPagerDuty(integrationKey);
    return { status: result.success ? "success" : "error", message: result.message };
  } catch (err: any) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    return { status: "error", message: err.message ?? "Failed to test PagerDuty" };
  }
}

export async function acknowledgeAlertAction(alertId: string): Promise<ActionResult> {
  try {
    const context = await requireRole(["super_admin"], "/super-admin/monitoring");
    const ok = await acknowledgeAlert(alertId, context.userId ?? "system");
    if (!ok) {
      return { status: "error", message: "Failed to acknowledge alert" };
    }
    revalidatePath("/super-admin/monitoring");
    return { status: "success", message: "Alert acknowledged" };
  } catch (err: any) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    return { status: "error", message: err.message ?? "Failed to acknowledge alert" };
  }
}

export async function getAlertHistoryAction(): Promise<{ history: AlertHistoryEntry[] }> {
  try {
    await requireRole(["super_admin"], "/super-admin/monitoring");
    const history = await getAlertHistory(50);
    return { history };
  } catch (err: any) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    return { history: [] };
  }
}

export async function getAlertConfigAction(): Promise<{ config: AlertConfig | null }> {
  try {
    await requireRole(["super_admin"], "/super-admin/monitoring");
    const config = await getAlertConfig();
    return { config };
  } catch (err: any) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    return { config: null };
  }
}
