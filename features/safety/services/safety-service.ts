/* eslint-disable @typescript-eslint/no-explicit-any */
import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type SafetyDashboard = {
  executive: {
    highRiskActionsToday: number;
    pendingApprovals: number;
    destructiveActionsBlocked: number;
    emergencyOverridesUsed: number;
    permissionViolationsPrevented: number;
    auditEventsGenerated: number;
    securityEscalations: number;
    policyViolations: number;
    tenantRiskScore: number;
    userRiskScore: number;
    systemRiskScore: number;
    complianceRiskScore: number;
    overallRiskScore: number;
    mfaEnforcementRate: number;
  };
  recentSensitiveActions: Array<{
    id: string; actionType: string; description: string;
    verificationMethod: string; mfaVerified: boolean; createdAt: string;
  }>;
  pendingApprovalItems: Array<{
    id: string; actionType: string; description: string;
    requestedBy: string | null; createdAt: string; expiresAt: string | null;
  }>;
  emergencyOverrides: Array<{
    id: string; useCase: string; status: string; accessLevel: string;
    requestedBy: string | null; approvedBy: string | null; createdAt: string;
  }>;
  rateLimitConfigs: Array<{
    label: string; maxRequests: number; windowMs: number; currentUsage: number;
  }>;
  protectedActions: Array<{
    action: string; riskLevel: string; requiresConfirmation: string;
    requiresMfa: boolean; requiresApproval: boolean;
  }>;
  violations: Array<{
    id: string; type: string; description: string; severity: string;
    createdAt: string; mitigatedAt: string | null;
  }>;
};

export async function getSafetyDashboard(): Promise<SafetyDashboard> {
  return getCachedSafetyDashboard();
}

const getCachedSafetyDashboard = unstable_cache(
  async (): Promise<SafetyDashboard> => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return getEmptyDashboard();
    const s = supabase as any;

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const todayStart = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";

      const [
        sensitiveRes, approvalsRes, overridesRes, violationsRes,
        auditCountRes, todayAuditRes, mfaRes
      ] = await Promise.all([
        s.from("sensitive_action_logs").select("*").gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(50),
        s.from("organization_approval_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(20),
        s.from("emergency_overrides").select("*").order("created_at", { ascending: false }).limit(20),
        (s.from("security_events") as any).select("*").in("event_type", ["permission_violation", "policy_violation", "unauthorized_access"]).gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(50),
        s.from("audit_logs").select("id", { count: "exact", head: true }),
        s.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
        s.from("user_mfa_methods").select("id, user_id", { count: "exact", head: false })
      ]);

      const sensitiveActions = sensitiveRes?.data ?? [];
      const approvals = approvalsRes?.data ?? [];
      const overrides = overridesRes?.data ?? [];
      const violations = violationsRes?.data ?? [];
      const totalAuditCount = auditCountRes?.count ?? 0;
      const todayAuditCount = todayAuditRes?.count ?? 0;
      const mfaMethods = mfaRes?.data ?? [];

      const highRiskToday = sensitiveActions.filter((a: any) =>
        ["delete_tenant", "delete_branch", "data_purge", "refund_approve", "bulk_operation"].includes(a.action_type) &&
        a.created_at >= todayStart
      ).length;

      const emergencyActive = overrides.filter((o: any) => o.status === "active" || o.status === "pending").length;
      const permissionViolations = violations.filter((v: any) => v.event_type === "permission_violation").length;
      const securityEscalations = violations.filter((v: any) => v.severity === "critical" || v.severity === "high").length;
      const mfaEnforcementRate = mfaMethods.length > 0 ? Math.round(mfaMethods.filter((m: any) => m.is_active).length / mfaMethods.length * 100) : 0;

      const totalRisks = highRiskToday + approvals.length + emergencyActive + permissionViolations + securityEscalations;
      const overallRiskScore = Math.min(100, Math.round(totalRisks * 5));
      const tenantRiskScore = Math.min(100, Math.round(highRiskToday * 10));
      const userRiskScore = Math.min(100, Math.round((emergencyActive * 3 + permissionViolations * 2)));
      const systemRiskScore = Math.min(100, Math.round(securityEscalations * 5));
      const complianceRiskScore = Math.min(100, Math.round((100 - mfaEnforcementRate) / 2));

      const protectedActions = [
        { action: "Delete Tenant", riskLevel: "critical", requiresConfirmation: "PURGE:slug", requiresMfa: true, requiresApproval: true },
        { action: "Delete Branch", riskLevel: "critical", requiresConfirmation: "DELETE", requiresMfa: true, requiresApproval: true },
        { action: "Delete User", riskLevel: "high", requiresConfirmation: "DELETE", requiresMfa: false, requiresApproval: false },
        { action: "Delete Membership", riskLevel: "high", requiresConfirmation: "DELETE", requiresMfa: false, requiresApproval: false },
        { action: "Delete Backups", riskLevel: "critical", requiresConfirmation: "DELETE", requiresMfa: true, requiresApproval: true },
        { action: "Bulk Delete Operations", riskLevel: "critical", requiresConfirmation: "CONFIRM", requiresMfa: true, requiresApproval: true },
        { action: "Data Purges", riskLevel: "critical", requiresConfirmation: "PURGE:slug", requiresMfa: true, requiresApproval: true },
        { action: "Restore Operations", riskLevel: "critical", requiresConfirmation: "RESTORE", requiresMfa: true, requiresApproval: true },
        { action: "Process Refund", riskLevel: "high", requiresConfirmation: "REFUND", requiresMfa: true, requiresApproval: false },
        { action: "Subscription Cancellation", riskLevel: "high", requiresConfirmation: "CANCEL", requiresMfa: false, requiresApproval: false },
        { action: "Transfer Ownership", riskLevel: "critical", requiresConfirmation: "TRANSFER", requiresMfa: true, requiresApproval: true },
        { action: "Export Member Data", riskLevel: "medium", requiresConfirmation: "EXPORT", requiresMfa: false, requiresApproval: false },
        { action: "Bulk Suspend", riskLevel: "critical", requiresConfirmation: "SUSPEND", requiresMfa: true, requiresApproval: true },
        { action: "Bulk Assign Package", riskLevel: "high", requiresConfirmation: "ASSIGN", requiresMfa: true, requiresApproval: true },
        { action: "Permission Change", riskLevel: "high", requiresConfirmation: "CONFIRM", requiresMfa: true, requiresApproval: false }
      ];

      return {
        executive: {
          highRiskActionsToday: highRiskToday,
          pendingApprovals: approvals.length,
          destructiveActionsBlocked: violations.filter((v: any) => v.event_type === "unauthorized_access").length,
          emergencyOverridesUsed: emergencyActive,
          permissionViolationsPrevented: permissionViolations,
          auditEventsGenerated: todayAuditCount,
          securityEscalations,
          policyViolations: violations.filter((v: any) => v.event_type === "policy_violation").length,
          tenantRiskScore, userRiskScore, systemRiskScore, complianceRiskScore, overallRiskScore,
          mfaEnforcementRate
        },
        recentSensitiveActions: sensitiveActions.slice(0, 25).map((a: any) => ({
          id: a.id, actionType: a.action_type, description: a.description ?? "",
          verificationMethod: a.verification_method ?? "none", mfaVerified: a.mfa_verified ?? false, createdAt: a.created_at
        })),
        pendingApprovalItems: approvals.map((a: any) => ({
          id: a.id, actionType: a.action_type, description: a.description ?? "",
          requestedBy: a.requested_by, createdAt: a.created_at, expiresAt: a.expires_at
        })),
        emergencyOverrides: overrides.map((o: any) => ({
          id: o.id, useCase: o.use_case, status: o.status, accessLevel: o.access_level,
          requestedBy: o.requested_by, approvedBy: o.approved_by, createdAt: o.created_at
        })),
        rateLimitConfigs: [
          { label: "Login Attempts", maxRequests: 30, windowMs: 300000, currentUsage: 0 },
          { label: "Create Role", maxRequests: 10, windowMs: 60000, currentUsage: 0 },
          { label: "Update Role", maxRequests: 20, windowMs: 60000, currentUsage: 0 },
          { label: "Delete Role", maxRequests: 5, windowMs: 60000, currentUsage: 0 },
          { label: "API Calls", maxRequests: 1000, windowMs: 60000, currentUsage: 0 },
          { label: "Bulk Imports", maxRequests: 3, windowMs: 3600000, currentUsage: 0 },
          { label: "Exports", maxRequests: 10, windowMs: 3600000, currentUsage: 0 },
          { label: "Notifications", maxRequests: 500, windowMs: 60000, currentUsage: 0 },
          { label: "AI Requests", maxRequests: 100, windowMs: 60000, currentUsage: 0 }
        ],
        protectedActions,
        violations: violations.slice(0, 25).map((v: any) => ({
          id: v.id, type: v.event_type, description: v.description ?? "", severity: v.severity ?? "medium",
          createdAt: v.created_at, mitigatedAt: v.mitigated_at ?? null
        }))
      };
    } catch (err: any) {
      console.error("Safety fetch error:", err.message);
      return getEmptyDashboard();
    }
  },
  ["production-safety-dashboard"],
  { revalidate: 30 }
);

function getEmptyDashboard(): SafetyDashboard {
  return {
    executive: {
      highRiskActionsToday: 0, pendingApprovals: 0, destructiveActionsBlocked: 0,
      emergencyOverridesUsed: 0, permissionViolationsPrevented: 0, auditEventsGenerated: 0,
      securityEscalations: 0, policyViolations: 0,
      tenantRiskScore: 0, userRiskScore: 0, systemRiskScore: 0, complianceRiskScore: 0,
      overallRiskScore: 0, mfaEnforcementRate: 0
    },
    recentSensitiveActions: [], pendingApprovalItems: [], emergencyOverrides: [],
    rateLimitConfigs: [], protectedActions: [], violations: []
  };
}
