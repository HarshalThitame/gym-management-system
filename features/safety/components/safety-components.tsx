"use client";

import { AlertTriangle, Ban, CheckCircle2, Clock, Eye, Info, Lock, Shield, ShieldAlert, Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type RiskLevel = "low" | "medium" | "high" | "critical";

// PERMISSION BADGE - Shows allowed/restricted/requires_approval/read_only
type PermissionBadgeProps = { status: "allowed" | "restricted" | "requires_approval" | "read_only"; resource?: string; action?: string };
export function PermissionBadge({ status, resource, action }: PermissionBadgeProps) {
  const configs: Record<string, { icon: typeof Lock; label: string; color: string }> = {
    allowed: { icon: CheckCircle2, label: "Allowed", color: "border-green-200 bg-green-50 text-green-700" },
    restricted: { icon: Ban, label: "Restricted", color: "border-red-200 bg-red-50 text-red-700" },
    requires_approval: { icon: Clock, label: "Requires Approval", color: "border-amber-200 bg-amber-50 text-amber-800" },
    read_only: { icon: Eye, label: "Read Only", color: "border-blue-200 bg-blue-50 text-blue-700" }
  };
  const config = configs[status]!;
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-2">
      <Badge className={config.color}>
        <Icon className="mr-1 size-3" />{config.label}
      </Badge>
      {resource && action && <span className="text-xs text-muted-foreground">{resource}.{action}</span>}
    </div>
  );
}

// DISABLED REASON - Shows why an action is disabled
type DisabledReasonProps = { reason: "no_permission" | "subscription_restriction" | "tenant_policy" | "compliance" | "pending_approval" | "rate_limited"; feature?: string; requiredPlan?: string; remainingTime?: string };
export function DisabledReason({ reason, feature, requiredPlan, remainingTime }: DisabledReasonProps) {
  const configs: Record<string, { icon: typeof Lock; title: string; message: string }> = {
    no_permission: { icon: Lock, title: "Missing Permission", message: `You don't have permission to ${feature ? `access ${feature}` : "perform this action"}. Contact your administrator.` },
    subscription_restriction: { icon: Shield, title: "Subscription Restriction", message: `${feature ?? "This feature"} requires the ${requiredPlan ?? "Standard"} plan. Upgrade to unlock.` },
    tenant_policy: { icon: ShieldAlert, title: "Tenant Policy Restriction", message: `Your organization's policy restricts ${feature ?? "this action"}.` },
    compliance: { icon: AlertTriangle, title: "Compliance Restriction", message: `${feature ?? "This action"} is restricted due to compliance requirements (GDPR/SOC 2).` },
    pending_approval: { icon: Clock, title: "Pending Approval", message: `${feature ?? "This action"} requires approval from a supervisor before execution.` },
    rate_limited: { icon: Siren, title: "Rate Limit Reached", message: `Too many requests. Try again in ${remainingTime ?? "a few minutes"}.` }
  };
  const config = configs[reason]!;
  const Icon = config.icon;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm" role="alert">
      <div className="rounded-full bg-accent/10 p-1.5 text-muted-foreground"><Icon className="size-4" /></div>
      <div>
        <p className="font-semibold">{config.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{config.message}</p>
      </div>
    </div>
  );
}

// IMPACT WARNING - Shows change impact analysis
type ImpactWarningProps = { title: string; risks: Array<{ label: string; severity: "info" | "warning" | "error" }>; recordsAffected?: number; tenantsAffected?: number; branchesAffected?: number; isReversible?: boolean };
export function ImpactWarning({ title, risks, recordsAffected, tenantsAffected, branchesAffected, isReversible }: ImpactWarningProps) {
  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 dark:bg-background">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-5 text-amber-600" />
        <p className="font-black text-amber-800">{title}</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {recordsAffected !== undefined && <ImpactStat label="Records Affected" value={recordsAffected.toLocaleString()} />}
        {tenantsAffected !== undefined && <ImpactStat label="Tenants Affected" value={String(tenantsAffected)} />}
        {branchesAffected !== undefined && <ImpactStat label="Branches Affected" value={String(branchesAffected)} />}
        {isReversible !== undefined && <ImpactStat label="Auto-Revert Available" value={isReversible ? "Yes" : "No"} />}
      </div>
      {risks.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {risks.map((r, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${r.severity === "error" ? "bg-red-100 text-red-800" : r.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
              {r.severity === "error" ? <Ban className="size-4" /> : r.severity === "warning" ? <AlertTriangle className="size-4" /> : <Info className="size-4" />}
              <span className="font-medium">{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImpactStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-white p-3 dark:bg-background"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-black">{value}</p></div>;
}

// AUDIT PREVIEW - Shows before/after state for changes
type AuditPreviewProps = { title: string; changes: Array<{ field: string; before: string; after: string }> };
export function AuditPreview({ title, changes }: AuditPreviewProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="size-4 text-muted-foreground" />
        <p className="font-semibold text-sm">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-4 font-semibold">Field</th>
              <th className="pb-2 pr-4 font-semibold">Before</th>
              <th className="pb-2 font-semibold">After</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="py-2 pr-4 font-medium">{c.field}</td>
                <td className="py-2 pr-4 text-muted-foreground line-through">{c.before}</td>
                <td className="py-2 font-semibold text-green-700">{c.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// RISK BADGE - Standardized risk level display
type RiskBadgeProps = { level: RiskLevel };
export function RiskBadge({ level }: RiskBadgeProps) {
  const colors: Record<string, string> = {
    low: "border-green-200 bg-green-50 text-green-700",
    medium: "border-amber-200 bg-amber-50 text-amber-800",
    high: "border-orange-200 bg-orange-50 text-orange-700",
    critical: "border-red-200 bg-red-50 text-red-700"
  };
  return <Badge className={colors[level] ?? ""}>{level.toUpperCase()}</Badge>;
}

// CONFIRMATION LEVEL INDICATOR
type ConfirmationLevelProps = { level: 1 | 2 | 3 | 4 | 5 };
export function ConfirmationLevelBadge({ level }: ConfirmationLevelProps) {
  const labels: Record<number, string> = { 1: "Simple Confirm", 2: "Type to Confirm", 3: "Password Required", 4: "MFA Required", 5: "Dual Approval" };
  const colors: Record<number, string> = { 1: "border-gray-200 bg-gray-50 text-gray-700", 2: "border-blue-200 bg-blue-50 text-blue-700", 3: "border-amber-200 bg-amber-50 text-amber-800", 4: "border-orange-200 bg-orange-50 text-orange-700", 5: "border-red-200 bg-red-50 text-red-700" };
  return <Badge className={colors[level] ?? ""}>L{level}: {labels[level]}</Badge>;
}

// RATE LIMIT STATUS
type RateLimitStatusProps = { label: string; maxRequests: number; currentUsage: number; windowMs: number };
export function RateLimitStatus({ label, maxRequests, currentUsage }: RateLimitStatusProps) {
  const usagePct = maxRequests > 0 ? Math.round(currentUsage / maxRequests * 100) : 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-muted-foreground" />
        <p className="font-medium">{label}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 w-20 rounded-full bg-border"><div className={`h-2 rounded-full ${usagePct > 80 ? "bg-red-500" : usagePct > 50 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${usagePct}%` }} /></div>
        <span className="font-semibold tabular-nums text-xs">{currentUsage}/{maxRequests}</span>
        <Badge className={usagePct > 80 ? "border-red-200 bg-red-50 text-red-700" : usagePct > 50 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-green-200 bg-green-50 text-green-700"}>{usagePct}%</Badge>
      </div>
    </div>
  );
}
