"use client";

import {
  Activity, AlertTriangle, Ban, Bell, CheckCircle2, Clock, Database, Eye, FileText,
  Gauge, Lock, Plus, RefreshCcw, Scale, Shield, ShieldAlert, Siren, Sliders,
  UserCog, UsersRound
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { PermissionBadge, DisabledReason, ImpactWarning, AuditPreview, RiskBadge, ConfirmationLevelBadge, RateLimitStatus } from "@/features/safety/components/safety-components";
import type { AuthContext } from "@/types/auth";
import type { SafetyDashboard } from "@/features/safety/services/safety-service";
import { formatAnalyticsLabel, formatCompactNumber } from "@/features/analytics/lib/business-rules";

type Props = { context: AuthContext; dashboard: SafetyDashboard };

export function ProductionSafetyDashboard({ context: _ctx, dashboard }: Props) {
  void _ctx;
  const e = dashboard.executive;

  return (
    <div className="space-y-6">
      <HeaderSection dashboard={dashboard} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="High-Risk Today" icon={<AlertTriangle className="size-5" />} detail={`${e.pendingApprovals} pending approvals`} value={String(e.highRiskActionsToday)} status={e.highRiskActionsToday === 0 ? "good" : e.highRiskActionsToday < 3 ? "watch" : "risk"} />
        <StatCard label="Pending Approvals" icon={<Clock className="size-5" />} detail="Awaiting review" value={String(e.pendingApprovals)} status={e.pendingApprovals === 0 ? "good" : "watch"} />
        <StatCard label="Emergency Overrides" icon={<Siren className="size-5" />} detail={`${e.emergencyOverridesUsed} active`} value={String(e.emergencyOverridesUsed)} status={e.emergencyOverridesUsed === 0 ? "good" : "risk"} />
        <StatCard label="Violations Prevented" icon={<ShieldAlert className="size-5" />} detail={`${e.policyViolations} policy violations`} value={String(e.permissionViolationsPrevented)} status={e.permissionViolationsPrevented === 0 ? "good" : "watch"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RiskScoreCard dashboard={dashboard} />
        <Card>
          <CardHeader><h3 className="text-lg font-black">Risk Distribution</h3></CardHeader>
          <CardContent className="space-y-4">
            <RiskBar label="Tenant Risk" score={e.tenantRiskScore} />
            <RiskBar label="User Risk" score={e.userRiskScore} />
            <RiskBar label="System Risk" score={e.systemRiskScore} />
            <RiskBar label="Compliance Risk" score={e.complianceRiskScore} />
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="font-black text-lg">Overall Risk Score</p>
                <OverallBadge score={e.overallRiskScore} />
              </div>
              <div className="mt-2 h-3 rounded-full bg-border">
                <div className={`h-3 rounded-full ${e.overallRiskScore < 30 ? "bg-green-500" : e.overallRiskScore < 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(e.overallRiskScore, 100)}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ProtectedActionsSection dashboard={dashboard} />
      <RateLimitSection dashboard={dashboard} />
      <SensitiveActionsSection dashboard={dashboard} />
      <ApprovalsSection dashboard={dashboard} />
      <EmergencySection dashboard={dashboard} />
      <ViolationsSection dashboard={dashboard} />

      {/* Component Showcase */}
      <Card>
        <CardHeader><h3 className="text-lg font-black">Safety Component Reference</h3></CardHeader>
        <CardContent className="space-y-6">
          <div><p className="font-semibold mb-3">Permission Badges</p><div className="flex flex-wrap gap-3"><PermissionBadge status="allowed" resource="payments" action="read" /><PermissionBadge status="restricted" resource="payments" action="refund" /><PermissionBadge status="requires_approval" resource="tenants" action="delete" /><PermissionBadge status="read_only" resource="backups" action="export" /></div></div>
          <div><p className="font-semibold mb-3">Disabled Reasons</p><div className="grid gap-3 md:grid-cols-2"><DisabledReason reason="no_permission" feature="Refund Processing" /><DisabledReason reason="subscription_restriction" feature="Advanced Reports" requiredPlan="Enterprise" /><DisabledReason reason="rate_limited" remainingTime="2 minutes" /><DisabledReason reason="pending_approval" feature="Tenant Deletion" /></div></div>
          <div><p className="font-semibold mb-3">Impact Warning</p><ImpactWarning title="This change affects multiple records" recordsAffected={2347} tenantsAffected={3} branchesAffected={14} isReversible={false} risks={[{ label: "This affects 2,347 active memberships", severity: "error" }, { label: "This action impacts 14 branches", severity: "warning" }, { label: "This operation cannot be automatically reversed", severity: "error" }]} /></div>
          <div><p className="font-semibold mb-3">Audit Preview</p><AuditPreview title="Pending Changes" changes={[{ field: "Organization Status", before: "Active", after: "Suspended" }, { field: "Member Limit", before: "500", after: "0" }, { field: "Branch Access", before: "All Branches", after: "Restricted" }]} /></div>
          <div><p className="font-semibold mb-3">Confirmation Levels</p><div className="flex flex-wrap gap-3"><ConfirmationLevelBadge level={1} /><ConfirmationLevelBadge level={2} /><ConfirmationLevelBadge level={3} /><ConfirmationLevelBadge level={4} /><ConfirmationLevelBadge level={5} /></div></div>
          <div><p className="font-semibold mb-3">Rate Limit Status</p><div className="grid gap-2 md:grid-cols-2"><RateLimitStatus label="Login Attempts" maxRequests={30} currentUsage={5} windowMs={300000} /><RateLimitStatus label="API Calls" maxRequests={1000} currentUsage={876} windowMs={60000} /><RateLimitStatus label="Bulk Imports" maxRequests={3} currentUsage={2} windowMs={3600000} /><RateLimitStatus label="Notifications" maxRequests={500} currentUsage={123} windowMs={60000} /></div></div>
        </CardContent>
      </Card>
    </div>
  );
}

function HeaderSection({ dashboard }: { dashboard: SafetyDashboard }) {
  const e = dashboard.executive;
  const posture = e.overallRiskScore < 30 ? "good" : e.overallRiskScore < 60 ? "watch" : "risk";
  const pColors = { good: "border-green-200 bg-green-50 text-green-700", watch: "border-amber-200 bg-amber-50 text-amber-800", risk: "border-red-200 bg-red-50 text-red-700" };
  return (
    <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-surface via-surface to-primary/5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
      <CardContent className="relative p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-red-200 bg-red-50 text-red-700"><Shield className="mr-1 size-3" /> Production Safety</Badge>
              <Badge className={pColors[posture]}>{posture === "good" ? "Low Risk" : posture === "watch" ? "Elevated Risk" : "High Risk"}</Badge>
              <Badge className="border-purple-200 bg-purple-50 text-purple-700">{e.auditEventsGenerated} events today</Badge>
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">
              Production Safety &<br />
              <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">Operational Governance</span>
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              {e.highRiskActionsToday} high-risk actions today · {e.pendingApprovals} pending approvals · {e.destructiveActionsBlocked} destructive actions blocked · {e.mfaEnforcementRate}% MFA enforcement rate
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/super-admin/security/emergency" variant="destructive" className="gap-2"><Siren className="size-4" /> Emergency</ButtonLink>
            <ButtonLink href="/super-admin/security/audit" variant="secondary" className="gap-2"><FileText className="size-4" /> Audit Logs</ButtonLink>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricBox label="MFA Rate" value={`${e.mfaEnforcementRate}%`} status={e.mfaEnforcementRate >= 90 ? "good" : e.mfaEnforcementRate >= 70 ? "watch" : "risk"} />
          <MetricBox label="Destructive Blocked" value={String(e.destructiveActionsBlocked)} status={e.destructiveActionsBlocked === 0 ? "good" : "watch"} />
          <MetricBox label="Security Escalations" value={String(e.securityEscalations)} status={e.securityEscalations === 0 ? "good" : "risk"} />
          <MetricBox label="Policy Violations" value={String(e.policyViolations)} status={e.policyViolations === 0 ? "good" : "watch"} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBox({ label, value, status }: { label: string; value: string; status: "good" | "watch" | "risk" }) {
  const c = { good: "text-green-600 border-green-200 bg-green-50", watch: "text-amber-600 border-amber-200 bg-amber-50", risk: "text-red-600 border-red-200 bg-red-50" };
  return <div className={`rounded-xl border ${c[status]} p-4 dark:bg-background`}><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={`mt-2 text-3xl font-black ${c[status].split(" ")[0]}`}>{value}</p></div>;
}

function RiskScoreCard({ dashboard }: { dashboard: SafetyDashboard }) {
  return (
    <Card>
      <CardHeader><h3 className="text-lg font-black">Operational Risk Score</h3></CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-6">
        <div className="relative flex size-36 items-center justify-center">
          <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle cx="18" cy="18" r="16" fill="none" stroke={dashboard.executive.overallRiskScore < 30 ? "#16a34a" : dashboard.executive.overallRiskScore < 60 ? "#d97706" : "#dc2626"} strokeWidth="3" strokeDasharray={`${100 - dashboard.executive.overallRiskScore} ${dashboard.executive.overallRiskScore}`} />
          </svg>
          <span className={`text-4xl font-black ${dashboard.executive.overallRiskScore < 30 ? "text-green-600" : dashboard.executive.overallRiskScore < 60 ? "text-amber-600" : "text-red-600"}`}>{dashboard.executive.overallRiskScore}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Risk Score (0-100)</p>
      </CardContent>
    </Card>
  );
}

function RiskBar({ label, score }: { label: string; score: number }) {
  return <div><div className="flex items-center justify-between text-sm"><p className="font-medium">{label}</p><span className={`font-black ${score < 30 ? "text-green-600" : score < 60 ? "text-amber-600" : "text-red-600"}`}>{score}</span></div><div className="mt-1 h-2 rounded-full bg-border"><div className={`h-2 rounded-full ${score < 30 ? "bg-green-500" : score < 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${score}%` }} /></div></div>;
}

function OverallBadge({ score }: { score: number }) {
  const c = score < 30 ? "border-green-200 bg-green-50 text-green-700" : score < 60 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700";
  return <Badge className={c}>{score < 30 ? "Low" : score < 60 ? "Medium" : "High"}</Badge>;
}

function ProtectedActionsSection({ dashboard }: { dashboard: SafetyDashboard }) {
  return (
    <Card>
      <CardHeader><h3 className="text-lg font-black">Destructive Action Protection</h3><p className="text-sm text-muted-foreground">{dashboard.protectedActions.length} actions with confirmation requirements</p></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            <th className="pb-3 pr-4">Action</th><th className="pb-3 pr-4">Risk</th><th className="pb-3 pr-4">Confirm</th><th className="pb-3 pr-4">MFA</th><th className="pb-3">Approval</th>
          </tr></thead>
          <tbody>
            {dashboard.protectedActions.map((a, i) => (
              <tr key={i} className="border-b border-border">
                <td className="py-3 pr-4 font-semibold">{a.action}</td>
                <td className="py-3 pr-4"><RiskBadge level={a.riskLevel as "low" | "medium" | "high" | "critical"} /></td>
                <td className="py-3 pr-4"><code className="rounded bg-muted px-2 py-0.5 text-xs">{a.requiresConfirmation}</code></td>
                <td className="py-3 pr-4">{a.requiresMfa ? <CheckCircle2 className="size-4 text-green-600" /> : <Ban className="size-4 text-muted-foreground" />}</td>
                <td className="py-3">{a.requiresApproval ? <CheckCircle2 className="size-4 text-green-600" /> : <Ban className="size-4 text-muted-foreground" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function RateLimitSection({ dashboard }: { dashboard: SafetyDashboard }) {
  return (
    <Card>
      <CardHeader><h3 className="text-lg font-black">Rate Limiting & Abuse Prevention</h3></CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-2">
        {dashboard.rateLimitConfigs.map((r) => <RateLimitStatus key={r.label} {...r} />)}
      </CardContent>
    </Card>
  );
}

function SensitiveActionsSection({ dashboard }: { dashboard: SafetyDashboard }) {
  return (
    <Card>
      <CardHeader><h3 className="text-lg font-black">Recent Sensitive Actions</h3></CardHeader>
      <CardContent className="space-y-2">
        {dashboard.recentSensitiveActions.slice(0, 10).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge className={a.mfaVerified ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}>{a.mfaVerified ? "MFA" : "No MFA"}</Badge>
              <p className="font-semibold">{formatAnalyticsLabel(a.actionType)}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>via {a.verificationMethod}</span>
              <span>{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
        {dashboard.recentSensitiveActions.length === 0 && <EmptyState text="No sensitive actions in the last 7 days" />}
      </CardContent>
    </Card>
  );
}

function ApprovalsSection({ dashboard }: { dashboard: SafetyDashboard }) {
  return (
    <Card>
      <CardHeader><h3 className="text-lg font-black">Pending Approvals</h3></CardHeader>
      <CardContent className="space-y-2">
        {dashboard.pendingApprovalItems.slice(0, 10).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
            <div>
              <p className="font-semibold">{formatAnalyticsLabel(a.actionType)}</p>
              <p className="text-xs text-muted-foreground">{a.description.slice(0, 80)}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{new Date(a.createdAt).toLocaleDateString()}</p>
              {a.expiresAt && <p>Expires: {new Date(a.expiresAt).toLocaleDateString()}</p>}
            </div>
          </div>
        ))}
        {dashboard.pendingApprovalItems.length === 0 && <EmptyState text="No pending approvals" />}
      </CardContent>
    </Card>
  );
}

function EmergencySection({ dashboard }: { dashboard: SafetyDashboard }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black">Emergency Override Management</h3>
          <ButtonLink href="/super-admin/security/emergency" size="sm" variant="destructive" className="gap-2"><Plus className="size-4" /> New Override</ButtonLink>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {dashboard.emergencyOverrides.slice(0, 10).map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
            <div className="flex items-center gap-2">
              <EmergencyStatusBadge status={o.status} />
              <p className="font-semibold">{formatAnalyticsLabel(o.useCase)}</p>
              <Badge variant="info">{o.accessLevel}</Badge>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Requested: {new Date(o.createdAt).toLocaleDateString()}</p>
              {o.approvedBy && <p>Approved</p>}
            </div>
          </div>
        ))}
        {dashboard.emergencyOverrides.length === 0 && <EmptyState text="No emergency overrides" />}
      </CardContent>
    </Card>
  );
}

function EmergencyStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { active: "border-red-200 bg-red-50 text-red-700", pending: "border-amber-200 bg-amber-50 text-amber-800", approved: "border-green-200 bg-green-50 text-green-700", expired: "border-gray-200 bg-gray-50 text-gray-700", denied: "border-gray-300 bg-gray-100 text-gray-500" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

function ViolationsSection({ dashboard }: { dashboard: SafetyDashboard }) {
  return (
    <Card>
      <CardHeader><h3 className="text-lg font-black">Security & Policy Violations</h3></CardHeader>
      <CardContent className="space-y-2">
        {dashboard.violations.slice(0, 10).map((v) => (
          <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
            <div className="flex items-center gap-2">
              <ViolationSeverityBadge severity={v.severity as "low" | "medium" | "high" | "critical"} />
              <p className="font-semibold">{formatAnalyticsLabel(v.type)}</p>
              <span className="text-xs text-muted-foreground">{v.description.slice(0, 60)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {v.mitigatedAt ? <Badge className="border-green-200 bg-green-50 text-green-700">Resolved</Badge> : <Badge className="border-red-200 bg-red-50 text-red-700">Open</Badge>}
              <span className="text-muted-foreground">{new Date(v.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {dashboard.violations.length === 0 && <EmptyState text="No violations recorded" />}
      </CardContent>
    </Card>
  );
}

function ViolationSeverityBadge({ severity }: { severity: "low" | "medium" | "high" | "critical" }) {
  const c: Record<string, string> = { critical: "border-red-200 bg-red-50 text-red-700", high: "border-orange-200 bg-orange-50 text-orange-700", medium: "border-amber-200 bg-amber-50 text-amber-800", low: "border-blue-200 bg-blue-50 text-blue-700" };
  return <Badge className={c[severity] ?? ""}>{severity.toUpperCase()}</Badge>;
}

function EmptyState({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-border bg-background p-4 text-center text-sm text-muted-foreground">{text}</div>; }
