"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";

export type SubscriptionHealthIssue = {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  organizationId?: string;
  organizationName?: string;
  subscriptionId?: string;
  detail?: string;
};

export type SubscriptionHealthReport = {
  timestamp: string;
  totalOrganizations: number;
  totalSubscriptions: number;
  issues: SubscriptionHealthIssue[];
  stats: {
    active: number;
    trial: number;
    expired: number;
    suspended: number;
    cancelled: number;
    noSubscription: number;
  };
};

export async function runSubscriptionHealthCheckAction(): Promise<{
  ok: boolean;
  data?: SubscriptionHealthReport;
  error?: string;
}> {
  try {
    await requireRole(["super_admin"], "/super-admin");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const supabase = getSupabaseAdminClient() as any;
  if (!supabase) return { ok: false, error: "Database connection failed." };

  const issues: SubscriptionHealthIssue[] = [];
  const now = new Date().toISOString();

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name, status")
    .in("status", ["active", "trial", "suspended"]);

  const { data: subscriptions } = await supabase
    .from("organization_subscriptions")
    .select("*, packages!inner(name, slug)");

  const orgMap = new Map<string, { id: string; name: string; status: string }>();
  for (const org of organizations ?? []) {
    orgMap.set(org.id, org);
  }

  const subMap = new Map<string, Record<string, unknown>>();
  for (const sub of subscriptions ?? []) {
    subMap.set(sub.organization_id, sub);
  }

  for (const org of organizations ?? []) {
    const sub = subMap.get(org.id);

    if (!sub) {
      if (org.status === "active") {
        issues.push({
          severity: "critical",
          category: "missing_subscription",
          message: `Active organization "${org.name}" has no subscription.`,
          organizationId: org.id,
          organizationName: org.name,
        });
      } else if (org.status === "suspended") {
        issues.push({
          severity: "warning",
          category: "suspended_org_no_subscription",
          message: `Suspended organization "${org.name}" has no subscription record.`,
          organizationId: org.id,
          organizationName: org.name,
        });
      }
      continue;
    }

    const subStatus = sub.status as string;
    const subExpiresAt = sub.expires_at as string | null;
    const subId = sub.id as string;

    if (org.status === "suspended" && subStatus !== "suspended") {
      issues.push({
        severity: "warning",
        category: "status_mismatch",
        message: `Organization "${org.name}" is suspended but subscription is "${subStatus}".`,
        organizationId: org.id,
        organizationName: org.name,
        subscriptionId: subId,
      });
    }

    if (org.status === "active" && subStatus === "suspended") {
      issues.push({
        severity: "warning",
        category: "status_mismatch",
        message: `Organization "${org.name}" is active but subscription is suspended.`,
        organizationId: org.id,
        organizationName: org.name,
        subscriptionId: subId,
      });
    }

    if (subStatus === "active" && subExpiresAt && new Date(subExpiresAt) < new Date()) {
      issues.push({
        severity: "warning",
        category: "expired_active",
        message: `Subscription for "${org.name}" is expired (${subExpiresAt}) but marked as active.`,
        organizationId: org.id,
        organizationName: org.name,
        subscriptionId: subId,
      });
    }

    if (subStatus === "trial" && !sub.trial_ends_at) {
      issues.push({
        severity: "warning",
        category: "trial_no_end",
        message: `Subscription for "${org.name}" is in trial but has no trial end date.`,
        organizationId: org.id,
        organizationName: org.name,
        subscriptionId: subId,
      });
    }

    if (subStatus === "cancelled" && !sub.cancelled_at) {
      issues.push({
        severity: "warning",
        category: "cancelled_no_date",
        message: `Subscription for "${org.name}" is cancelled but has no cancellation date.`,
        organizationId: org.id,
        organizationName: org.name,
        subscriptionId: subId,
      });
    }
  }

  const { data: orphanInvoices } = await supabase
    .from("org_subscription_invoices")
    .select("id, invoice_number, organization_id, subscription_id, status, total_amount")
    .not("subscription_id", "in", `(${(subscriptions ?? []).map((s: Record<string, unknown>) => s.id).join(",")})`);

  if (orphanInvoices && orphanInvoices.length > 0) {
    issues.push({
      severity: "critical",
      category: "orphaned_invoices",
      message: `${orphanInvoices.length} invoice(s) reference non-existent subscriptions.`,
      detail: orphanInvoices.slice(0, 5).map((inv: Record<string, unknown>) => `#${inv.invoice_number}`).join(", "),
    });
  }

  const stats = {
    active: (subscriptions ?? []).filter((s: Record<string, unknown>) => s.status === "active").length,
    trial: (subscriptions ?? []).filter((s: Record<string, unknown>) => s.status === "trial").length,
    expired: (subscriptions ?? []).filter((s: Record<string, unknown>) => s.status === "expired").length,
    suspended: (subscriptions ?? []).filter((s: Record<string, unknown>) => s.status === "suspended").length,
    cancelled: (subscriptions ?? []).filter((s: Record<string, unknown>) => s.status === "cancelled").length,
    noSubscription: (organizations ?? []).filter((o: Record<string, unknown>) => !subMap.has(o.id as string)).length,
  };

  return {
    ok: true,
    data: {
      timestamp: now,
      totalOrganizations: organizations?.length ?? 0,
      totalSubscriptions: subscriptions?.length ?? 0,
      issues,
      stats,
    },
  };
}

export function getHealthSeverityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "warning":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "info":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function getHealthSeverityIcon(severity: string): string {
  switch (severity) {
    case "critical":
      return "🚫";
    case "warning":
      return "⚠️";
    case "info":
      return "ℹ️";
    default:
      return "❓";
  }
}
