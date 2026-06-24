import type { EnterpriseKpi, HealthStatus, PlanTier } from "@/types/enterprise";
import type { Json } from "@/types/database";

export function slugifyEnterpriseName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeDomain(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");

  return normalized || null;
}

export function isFullTenantDomain(value: string) {
  const normalized = normalizeDomain(value);
  return Boolean(normalized && (normalized === "localhost" || normalized.includes(".")));
}

export function isResolvableTenantDomain(input: { status: string; organizationStatus?: string | null; tenantStatus?: string | null; branchStatus?: string | null }) {
  const organizationAllowed = !input.organizationStatus || input.organizationStatus === "active" || input.organizationStatus === "trial";
  const tenantAllowed = !input.tenantStatus || input.tenantStatus === "active" || input.tenantStatus === "trial";
  const branchAllowed = !input.branchStatus || input.branchStatus === "active" || input.branchStatus === "planned" || input.branchStatus === "maintenance";

  return input.status === "verified" && organizationAllowed && tenantAllowed && branchAllowed;
}

export function calculateUsagePercent(used: number, limit: number | null | undefined) {
  if (!limit || limit <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((used / limit) * 10000) / 100);
}

export function enterpriseStatusFromPercent(percent: number): EnterpriseKpi["status"] {
  if (percent >= 90) {
    return "risk";
  }
  if (percent >= 70) {
    return "watch";
  }
  return "good";
}

export function healthStatus(checks: Array<{ status: HealthStatus }>): EnterpriseKpi["status"] {
  if (checks.some((check) => check.status === "down")) {
    return "risk";
  }
  if (checks.some((check) => check.status === "degraded" || check.status === "unknown")) {
    return "watch";
  }
  return "good";
}

export function isFeatureAvailableForPlan(input: { enabled: boolean; status: string; targetPlanTiers: string[]; planTier: PlanTier }) {
  return input.enabled && input.status === "active" && input.targetPlanTiers.includes(input.planTier);
}

export function retentionRisk(retentionDays: number) {
  if (retentionDays < 180) {
    return "risk" as const;
  }
  if (retentionDays < 365) {
    return "watch" as const;
  }
  return "good" as const;
}

export function buildRecoveryPointLabel(value: string | null) {
  if (!value) {
    return "No recovery point";
  }
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatEnterpriseLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function parseJsonObject(value: string): { ok: true; value: Json } | { ok: false; message: string } {
  if (!value.trim()) {
    return { ok: true, value: {} };
  }

  try {
    const parsed = JSON.parse(value) as Json;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, message: "Enter a JSON object." };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, message: "Enter valid JSON." };
  }
}

export function parseCsvList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value);
}

export function formatCurrency(value?: number | null, currency = "INR") {
  const safe = value ?? 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(safe);
}
