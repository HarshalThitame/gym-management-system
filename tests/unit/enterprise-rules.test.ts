import { describe, expect, it } from "vitest";
import {
  buildRecoveryPointLabel,
  calculateUsagePercent,
  enterpriseStatusFromPercent,
  formatEnterpriseLabel,
  healthStatus,
  isFullTenantDomain,
  isFeatureAvailableForPlan,
  isResolvableTenantDomain,
  normalizeDomain,
  parseCsvList,
  parseJsonObject,
  retentionRisk,
  slugifyEnterpriseName
} from "@/features/enterprise/lib/business-rules";

describe("enterprise platform business rules", () => {
  it("normalizes tenant identifiers and domains", () => {
    expect(slugifyEnterpriseName(" Apex Fitness Group! ")).toBe("apex-fitness-group");
    expect(normalizeDomain("https://www.ApexFit.com/path")).toBe("apexfit.com");
    expect(normalizeDomain("https://Gym-A.ApexFit.com:3000/member?tab=plans")).toBe("gym-a.apexfit.com");
    expect(normalizeDomain("   ")).toBeNull();
    expect(isFullTenantDomain("apexfit")).toBe(false);
    expect(isFullTenantDomain("apexfit.com")).toBe(true);
    expect(isFullTenantDomain("localhost:3000")).toBe(true);
    expect(formatEnterpriseLabel("multi_branch")).toBe("Multi Branch");
  });

  it("calculates usage and risk states", () => {
    expect(calculateUsagePercent(750, 1000)).toBe(75);
    expect(calculateUsagePercent(1200, 1000)).toBe(100);
    expect(calculateUsagePercent(10, 0)).toBe(0);
    expect(enterpriseStatusFromPercent(95)).toBe("risk");
    expect(enterpriseStatusFromPercent(75)).toBe("watch");
    expect(enterpriseStatusFromPercent(30)).toBe("good");
  });

  it("evaluates feature availability and retention risk", () => {
    expect(isFeatureAvailableForPlan({ enabled: true, status: "active", targetPlanTiers: ["enterprise"], planTier: "enterprise" })).toBe(true);
    expect(isFeatureAvailableForPlan({ enabled: true, status: "paused", targetPlanTiers: ["enterprise"], planTier: "enterprise" })).toBe(false);
    expect(isResolvableTenantDomain({ status: "verified", organizationStatus: "active", tenantStatus: "active", branchStatus: "active" })).toBe(true);
    expect(isResolvableTenantDomain({ status: "pending", organizationStatus: "active", tenantStatus: "active" })).toBe(false);
    expect(isResolvableTenantDomain({ status: "verified", organizationStatus: "suspended", tenantStatus: "active" })).toBe(false);
    expect(retentionRisk(120)).toBe("risk");
    expect(retentionRisk(240)).toBe("watch");
    expect(retentionRisk(730)).toBe("good");
  });

  it("summarizes health checks and parses admin input", () => {
    expect(healthStatus([{ status: "healthy" }, { status: "degraded" }])).toBe("watch");
    expect(healthStatus([{ status: "down" }])).toBe("risk");
    expect(parseCsvList("starter, professional,enterprise")).toEqual(["starter", "professional", "enterprise"]);
    expect(parseJsonObject("{\"mfa\":true}")).toEqual({ ok: true, value: { mfa: true } });
    expect(parseJsonObject("[1]")).toEqual({ ok: false, message: "Enter a JSON object." });
  });

  it("formats recovery point labels", () => {
    expect(buildRecoveryPointLabel(null)).toBe("No recovery point");
    expect(buildRecoveryPointLabel("2026-06-10T00:00:00.000Z")).toContain("2026");
  });
});
