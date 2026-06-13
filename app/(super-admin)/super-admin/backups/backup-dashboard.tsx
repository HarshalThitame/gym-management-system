"use client";

import {
  Activity, AlertTriangle, Archive, ArrowUpRight, Ban, BarChart3, Bell, CheckCircle2,
  Clock, Database, Download, FileText, Gauge, Globe2, HeartPulse, Inbox, Lock,
  RefreshCcw, Server, ShieldCheck, Shield, Sidebar, TrendingUp, UsersRound, Zap
} from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import type { AuthContext } from "@/types/auth";
import type { BackupDashboard } from "@/features/backup/services/backup-service";
import { formatAnalyticsLabel, formatCompactNumber, formatCurrency } from "@/features/analytics/lib/business-rules";

type Props = { context: AuthContext; dashboard: BackupDashboard };
type TabId = "overview" | "backups" | "recovery" | "replication" | "verification" | "storage" | "security" | "schedules" | "pitr" | "compliance" | "approvals" | "dr";

export function BackupDashboardClient({ context: _ctx, dashboard }: Props) {
  void _ctx;
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; count?: number }> = [
    { id: "overview", label: "Overview", icon: <Gauge className="size-4" /> },
    { id: "backups", label: "Backups", icon: <Database className="size-4" />, count: dashboard.recentBackups.length },
    { id: "recovery", label: "Recovery", icon: <Activity className="size-4" />, count: dashboard.executive.activeRecoveryJobs },
    { id: "replication", label: "Replication", icon: <Globe2 className="size-4" />, count: dashboard.replicationStatus.length },
    { id: "verification", label: "Verification", icon: <CheckCircle2 className="size-4" />, count: dashboard.verifications.length },
    { id: "storage", label: "Storage", icon: <Server className="size-4" />, count: dashboard.storageTiers.length },
    { id: "security", label: "Security", icon: <Shield className="size-4" />, count: dashboard.securityEvents.filter((e) => e.mitigationStatus !== "resolved").length },
    { id: "schedules", label: "Schedules", icon: <Clock className="size-4" />, count: dashboard.schedules.filter((s) => s.isActive).length },
    { id: "pitr", label: "PITR", icon: <RefreshCcw className="size-4" />, count: dashboard.pitrPoints.length },
    { id: "compliance", label: "Compliance", icon: <FileText className="size-4" />, count: dashboard.complianceReports.length },
    { id: "approvals", label: "Approvals", icon: <ShieldCheck className="size-4" />, count: dashboard.approvals.filter((a) => a.status === "pending").length },
    { id: "dr", label: "DR", icon: <HeartPulse className="size-4" />, count: dashboard.drStatus.length }
  ];

  return (
    <div className="space-y-6">
      <HeaderSection dashboard={dashboard} />
      <TabBar tabs={tabs} active={activeTab} onSelect={setActiveTab} />
      {activeTab === "overview" && <OverviewSection dashboard={dashboard} />}
      {activeTab === "backups" && <BackupsSection dashboard={dashboard} />}
      {activeTab === "recovery" && <RecoverySection dashboard={dashboard} />}
      {activeTab === "replication" && <ReplicationSection dashboard={dashboard} />}
      {activeTab === "verification" && <VerificationSection dashboard={dashboard} />}
      {activeTab === "storage" && <StorageSection dashboard={dashboard} />}
      {activeTab === "security" && <SecuritySection dashboard={dashboard} />}
      {activeTab === "schedules" && <SchedulesSection dashboard={dashboard} />}
      {activeTab === "pitr" && <PitrSection dashboard={dashboard} />}
      {activeTab === "compliance" && <ComplianceSection dashboard={dashboard} />}
      {activeTab === "approvals" && <ApprovalsSection dashboard={dashboard} />}
      {activeTab === "dr" && <DrSection dashboard={dashboard} />}
    </div>
  );
}

function HeaderSection({ dashboard }: { dashboard: BackupDashboard }) {
  const e = dashboard.executive;
  const posture = e.drReadinessScore >= 90 ? "good" : e.drReadinessScore >= 70 ? "watch" : "risk";
  const pColors = { good: "border-green-200 bg-green-50 text-green-700", watch: "border-amber-200 bg-amber-50 text-amber-800", risk: "border-red-200 bg-red-50 text-red-700" };
  return (
    <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-surface via-surface to-primary/5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
      <CardContent className="relative p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-purple-200 bg-purple-50 text-purple-800"><Database className="mr-1 size-3" /> Backup &amp; Recovery Center</Badge>
              <Badge className={pColors[posture]}>{posture === "good" ? "DR Ready" : posture === "watch" ? "Needs Attention" : "DR Risk"}</Badge>
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">
              Enterprise Backup, Recovery &<br />
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Disaster Recovery Center</span>
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              {e.totalBackups} backups · {e.recoverySuccessRate}% recovery success · {e.drReadinessScore}% DR readiness · {e.rpoMinutes}min RPO · {e.rtoMinutes}min RTO
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/super-admin/backups?tab=recovery" variant="primary" className="gap-2"><Activity className="size-4" /> New Recovery</ButtonLink>
            <ButtonLink href="/super-admin/backups?tab=dr" variant="secondary" className="gap-2"><HeartPulse className="size-4" /> DR Status</ButtonLink>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricBox label="Total Backups" value={formatCompactNumber(e.totalBackups)} status={e.totalBackups > 0 ? "good" : "watch"} />
          <MetricBox label="Failed" value={formatCompactNumber(e.failedBackups)} status={e.failedBackups === 0 ? "good" : e.failedBackups < 5 ? "watch" : "risk"} />
          <MetricBox label="Recovery Rate" value={`${e.recoverySuccessRate}%`} status={e.recoverySuccessRate >= 99 ? "good" : e.recoverySuccessRate >= 90 ? "watch" : "risk"} />
          <MetricBox label="RPO / RTO" value={`${e.rpoMinutes}m / ${e.rtoMinutes}m`} status={e.rpoMinutes <= 5 && e.rtoMinutes <= 15 ? "good" : "watch"} />
          <MetricBox label="DR Readiness" value={`${e.drReadinessScore}%`} status={e.drReadinessScore >= 90 ? "good" : e.drReadinessScore >= 70 ? "watch" : "risk"} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBox({ label, value, status }: { label: string; value: string; status: "good" | "watch" | "risk" }) {
  const c = { good: "text-green-600 border-green-200 bg-green-50", watch: "text-amber-600 border-amber-200 bg-amber-50", risk: "text-red-600 border-red-200 bg-red-50" };
  return <div className={`rounded-xl border ${c[status]} p-4 dark:bg-background`}><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={`mt-2 text-3xl font-black ${c[status].split(" ")[0]}`}>{value}</p></div>;
}

function TabBar({ tabs, active, onSelect }: { tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; count?: number }>; active: string; onSelect: (id: TabId) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
            active === t.id ? "border-primary/30 bg-primary/10 text-primary shadow-sm" : "border-border bg-surface text-foreground/70 hover:border-primary/20 hover:text-foreground"
          }`}>
          {t.icon}{t.label}
          {t.count !== undefined && t.count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active === t.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ icon, subtitle, title }: { icon: React.ReactNode; subtitle: string; title: string }) {
  return <div className="flex items-center gap-3"><div className="rounded-md bg-primary/10 p-1.5 text-primary">{icon}</div><div><h2 className="text-2xl font-black">{title}</h2><p className="text-sm text-muted-foreground">{subtitle}</p></div></div>;
}
function EmptyState({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-border bg-background p-5 text-center text-sm font-semibold text-muted-foreground">{text}</div>; }

// ========== OVERVIEW ==========
function OverviewSection({ dashboard }: { dashboard: BackupDashboard }) {
  const e = dashboard.executive;
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Gauge className="size-5" />} subtitle="Executive backup KPIs and real-time status" title="Global Backup Operations Dashboard" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Backups" icon={<Database className="size-5" />} detail={`${e.successfulBackups} successful · ${e.failedBackups} failed`} value={formatCompactNumber(e.totalBackups)} status={e.failedBackups === 0 ? "good" : "watch"} />
        <StatCard label="Data Protected" icon={<Server className="size-5" />} detail={`${formatCompactNumber(Math.round(e.dataProtectedBytes / 1024 / 1024 / 1024))} GB total`} value={formatCompactNumber(Math.round(e.dataProtectedBytes / 1024 / 1024 / 1024)) + " GB"} status="good" />
        <StatCard label="Storage Consumed" icon={<Inbox className="size-5" />} detail={`${formatCompactNumber(Math.round(e.storageConsumedBytes / 1024 / 1024 / 1024))} GB used`} value={formatCompactNumber(Math.round(e.storageConsumedBytes / 1024 / 1024 / 1024)) + " GB"} status="good" />
        <StatCard label="Active Recovery" icon={<Activity className="size-5" />} detail={`${e.activeRecoveryJobs} jobs in progress`} value={String(e.activeRecoveryJobs)} status={e.activeRecoveryJobs === 0 ? "good" : "watch"} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-lg font-black">Recovery Readiness</h3></CardHeader>
          <CardContent className="space-y-4">
            <ComparisonRow label="Recovery Point Objective" value={`${e.rpoMinutes} min`} target="< 5 min" status={e.rpoMinutes <= 5 ? "good" : "watch"} />
            <ComparisonRow label="Recovery Time Objective" value={`${e.rtoMinutes} min`} target="< 15 min" status={e.rtoMinutes <= 15 ? "good" : "watch"} />
            <ComparisonRow label="Recovery Success Rate" value={`${e.recoverySuccessRate}%`} target="> 99%" status={e.recoverySuccessRate >= 99 ? "good" : e.recoverySuccessRate >= 90 ? "watch" : "risk"} />
            <ComparisonRow label="DR Readiness Score" value={`${e.drReadinessScore}%`} target="> 90%" status={e.drReadinessScore >= 90 ? "good" : e.drReadinessScore >= 70 ? "watch" : "risk"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-lg font-black">Storage Tier Usage</h3></CardHeader>
          <CardContent className="space-y-3">
            {dashboard.storageTiers.map((t) => (
              <div key={t.name} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TierDot tier={t.name} />
                    <p className="font-semibold capitalize">{t.name}</p>
                  </div>
                  <span className="text-sm font-black">{t.usagePercent}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-border">
                  <div className={`h-2 rounded-full ${t.usagePercent > 80 ? "bg-red-500" : t.usagePercent > 60 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(t.usagePercent, 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.backupCount} backups · {Math.round(t.usedBytes / 1024 / 1024 / 1024)} GB / {Math.round(t.totalBytes / 1024 / 1024 / 1024)} GB</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {dashboard.securityEvents.filter((e) => e.mitigationStatus !== "resolved" && e.severity === "critical").length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader><div className="flex items-center gap-2"><AlertTriangle className="size-5 text-red-600" /><h3 className="text-lg font-black text-red-800">Security Alerts</h3></div></CardHeader>
          <CardContent className="space-y-2">
            {dashboard.securityEvents.filter((e) => e.mitigationStatus !== "resolved" && e.severity === "critical").slice(0, 3).map((e) => (
              <div key={e.id} className="rounded-lg bg-white p-3 text-sm dark:bg-background">
                <div className="flex items-center gap-2"><Badge className="border-red-200 bg-red-50 text-red-700">{formatAnalyticsLabel(e.type)}</Badge><p className="font-semibold">{e.description}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ComparisonRow({ label, value, target, status }: { label: string; value: string; target: string; status: "good" | "watch" | "risk" }) {
  const dotC = { good: "bg-green-500", watch: "bg-amber-500", risk: "bg-red-500" };
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${dotC[status]}`} /><p className="font-semibold text-sm">{label}</p></div><div className="flex items-center gap-3"><span className="font-black">{value}</span><span className="text-xs text-muted-foreground">target {target}</span></div></div>;
}

function TierDot({ tier }: { tier: string }) {
  const c: Record<string, string> = { hot: "bg-red-500", warm: "bg-amber-500", cold: "bg-blue-500", archive: "bg-purple-500" };
  return <span className={`size-2.5 rounded-full ${c[tier] ?? "bg-gray-400"}`} />;
}

// ========== BACKUPS ==========
function BackupsSection({ dashboard }: { dashboard: BackupDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Database className="size-5" />} subtitle="Complete backup inventory" title="Enterprise Backup Catalog" />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              <th className="p-4 pr-3">Type</th><th className="p-4 pr-3">Scope</th><th className="p-4 pr-3">Status</th>
              <th className="p-4 pr-3">Size</th><th className="p-4 pr-3">Tier</th><th className="p-4 pr-3">Encryption</th>
              <th className="p-4 pr-3">Verification</th><th className="p-4 pr-3">Immutable</th><th className="p-4">Created</th>
            </tr></thead>
            <tbody>
              {dashboard.recentBackups.map((b) => (
                <tr key={b.id} className="border-b border-border">
                  <td className="p-4 pr-3"><Badge variant="info">{b.type}</Badge></td>
                  <td className="p-4 pr-3 font-semibold">{b.scope}</td>
                  <td className="p-4 pr-3"><BackupStatusBadge status={b.status} /></td>
                  <td className="p-4 pr-3 font-black tabular-nums">{Math.round(b.sizeBytes / 1024 / 1024)} MB</td>
                  <td className="p-4 pr-3"><TierBadge tier={b.storageTier} /></td>
                  <td className="p-4 pr-3"><EncryptionBadge status={b.encryptionStatus} /></td>
                  <td className="p-4 pr-3"><VerifBadge status={b.verificationStatus} /></td>
                  <td className="p-4 pr-3">{b.isImmutable ? <Lock className="size-4 text-green-600" /> : "—"}</td>
                  <td className="p-4 text-muted-foreground">{new Date(b.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {dashboard.recentBackups.length === 0 && <tr><td colSpan={9} className="p-4"><EmptyState text="No backup jobs found" /></td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function BackupStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { completed: "border-green-200 bg-green-50 text-green-700", running: "border-blue-200 bg-blue-50 text-blue-700", queued: "border-amber-200 bg-amber-50 text-amber-800", failed: "border-red-200 bg-red-50 text-red-700", cancelled: "border-gray-200 bg-gray-50 text-gray-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}
function TierBadge({ tier }: { tier: string }) {
  const c: Record<string, string> = { hot: "bg-red-50 text-red-700 border-red-200", warm: "bg-amber-50 text-amber-800 border-amber-200", cold: "bg-blue-50 text-blue-700 border-blue-200", archive: "bg-purple-50 text-purple-700 border-purple-200" };
  return <Badge className={c[tier] ?? ""}>{tier}</Badge>;
}
function EncryptionBadge({ status }: { status: string }) {
  return <Badge className={status === "aes256" ? "border-green-200 bg-green-50 text-green-700" : status === "customer_key" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 bg-gray-50 text-gray-700"}>{status === "aes256" ? "AES-256" : status === "customer_key" ? "CMK" : "None"}</Badge>;
}
function VerifBadge({ status }: { status: string }) {
  const c: Record<string, string> = { verified: "border-green-200 bg-green-50 text-green-700", failed: "border-red-200 bg-red-50 text-red-700", pending: "border-amber-200 bg-amber-50 text-amber-800", in_progress: "border-blue-200 bg-blue-50 text-blue-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

// ========== RECOVERY ==========
function RecoverySection({ dashboard }: { dashboard: BackupDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Activity className="size-5" />} subtitle="Full recovery workflow with approval tracking" title="Recovery Operations Center" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickBox label="Total Sessions" value={String(dashboard.recoverySessions.length)} />
        <QuickBox label="Completed" value={String(dashboard.recoverySessions.filter((s) => s.status === "completed").length)} />
        <QuickBox label="Failed" value={String(dashboard.recoverySessions.filter((s) => s.status === "failed").length)} />
        <QuickBox label="Active" value={String(dashboard.executive.activeRecoveryJobs)} />
      </div>
      {dashboard.recoverySessions.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-lg font-black">Recovery Sessions</h3></CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recoverySessions.slice(0, 20).map((s) => (
              <div key={s.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">#{s.number}</span>
                  <p className="font-black">{formatAnalyticsLabel(s.type)}</p>
                  <RecoveryStatusBadge status={s.status} />
                  {s.riskAssessment && <RiskBadge risk={s.riskAssessment} />}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Recovery point: {new Date(s.recoveryPoint).toLocaleString("en-IN")} · {s.recordsAffected !== null ? `${s.recordsAffected} records` : ""} · Est. downtime: {s.estimatedDowntime ?? "—"} min</p>
                {s.validationResult && <p className="mt-1 text-xs font-semibold">Validation: <Badge className={s.validationResult === "passed" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>{formatAnalyticsLabel(s.validationResult)}</Badge></p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function RecoveryStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { completed: "border-green-200 bg-green-50 text-green-700", failed: "border-red-200 bg-red-50 text-red-700", executing: "border-blue-200 bg-blue-50 text-blue-700", approved: "border-indigo-200 bg-indigo-50 text-indigo-700", pending: "border-amber-200 bg-amber-50 text-amber-800", cancelled: "border-gray-200 bg-gray-50 text-gray-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}
function RiskBadge({ risk }: { risk: string }) {
  const c: Record<string, string> = { low: "border-green-200 bg-green-50 text-green-700", medium: "border-amber-200 bg-amber-50 text-amber-800", high: "border-orange-200 bg-orange-50 text-orange-700", critical: "border-red-200 bg-red-50 text-red-700" };
  return <Badge className={c[risk] ?? ""}>{risk}</Badge>;
}
function QuickBox({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-gradient-to-br from-background to-accent/5 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }

// ========== REPLICATION ==========
function ReplicationSection({ dashboard }: { dashboard: BackupDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Globe2 className="size-5" />} subtitle="Cross-region backup replication monitoring" title="Cross-Region Replication" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.replicationStatus.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{r.sourceRegion} → {r.targetRegion}</p>
                <ReplStatusBadge status={r.status} />
              </div>
              <p className="text-xs text-muted-foreground">{formatAnalyticsLabel(r.type)}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Lag</p><p className="font-black">{r.lagSeconds !== null ? `${r.lagSeconds}s` : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Health</p><p className={`font-black ${r.isHealthy ? "text-green-600" : "text-red-600"}`}>{r.isHealthy ? "Healthy" : "Unhealthy"}</p></div>
              </div>
              {r.lastSyncedAt && <p className="mt-2 text-xs text-muted-foreground">Last synced: {new Date(r.lastSyncedAt).toLocaleString()}</p>}
            </CardContent>
          </Card>
        ))}
        {dashboard.replicationStatus.length === 0 && <div className="xl:col-span-3"><EmptyState text="No replication configured" /></div>}
      </div>
    </div>
  );
}
function ReplStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { synced: "border-green-200 bg-green-50 text-green-700", syncing: "border-blue-200 bg-blue-50 text-blue-700", lagging: "border-amber-200 bg-amber-50 text-amber-800", failed: "border-red-200 bg-red-50 text-red-700", not_configured: "border-gray-200 bg-gray-50 text-gray-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

// ========== VERIFICATION ==========
function VerificationSection({ dashboard }: { dashboard: BackupDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<CheckCircle2 className="size-5" />} subtitle="Automated backup integrity verification" title="Backup Verification & Validation" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickBox label="Total Checks" value={String(dashboard.verifications.length)} />
        <QuickBox label="Passed" value={String(dashboard.verifications.filter((v) => v.status === "passed").length)} />
        <QuickBox label="Failed" value={String(dashboard.verifications.filter((v) => v.status === "failed").length)} />
        <QuickBox label="Pending" value={String(dashboard.verifications.filter((v) => v.status === "pending").length)} />
      </div>
      {dashboard.verifications.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-0">
            {dashboard.verifications.slice(0, 15).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 border-b border-border p-4 text-sm last:border-0">
                <div className="flex items-center gap-2">
                  <VerifIcon status={v.status} />
                  <p className="font-semibold">{formatAnalyticsLabel(v.type)}</p>
                  <span className="text-xs text-muted-foreground">Job: {v.backupJobId.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-3">
                  {v.checksumMatch !== null && <Badge className={v.checksumMatch ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>{v.checksumMatch ? "Checksum OK" : "Checksum Fail"}</Badge>}
                  <VerifBadge status={v.status} />
                  {v.verifiedAt && <span className="text-xs text-muted-foreground">{new Date(v.verifiedAt).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function VerifIcon({ status }: { status: string }) {
  const c: Record<string, string> = { passed: "text-green-600", failed: "text-red-600", pending: "text-amber-600", running: "text-blue-600" };
  return <span className={`size-2 rounded-full ${c[status] ?? "bg-gray-400"}`} />;
}

// ========== STORAGE ==========
function StorageSection({ dashboard }: { dashboard: BackupDashboard }) {
  const totalUsed = dashboard.storageTiers.reduce((s, t) => s + t.usedBytes, 0);
  const totalCapacity = dashboard.storageTiers.reduce((s, t) => s + t.totalBytes, 0);
  const totalDedup = dashboard.storageTiers.reduce((s, t) => s + (t.dedupSavings ?? 0), 0);
  const totalCompression = dashboard.storageTiers.reduce((s, t) => s + (t.compressionSavings ?? 0), 0);
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Server className="size-5" />} subtitle={`${Math.round(totalUsed / 1024 / 1024 / 1024)} GB / ${Math.round(totalCapacity / 1024 / 1024 / 1024)} GB · ${totalCapacity > 0 ? Math.round(totalUsed / totalCapacity * 100) : 0}% utilized`} title="Backup Storage Management" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Capacity" icon={<Server className="size-5" />} detail={formatCompactNumber(Math.round(totalCapacity / 1024 / 1024 / 1024)) + " GB"} value={formatCompactNumber(Math.round(totalCapacity / 1024 / 1024 / 1024)) + " GB"} status="good" />
        <StatCard label="Used Storage" icon={<Database className="size-5" />} detail={formatCompactNumber(Math.round(totalUsed / 1024 / 1024 / 1024)) + " GB used"} value={formatCompactNumber(Math.round(totalUsed / 1024 / 1024 / 1024)) + " GB"} status={totalUsed / totalCapacity > 0.8 ? "risk" : "good"} />
        <StatCard label="Dedup Savings" icon={<TrendingUp className="size-5" />} detail={Math.round(totalDedup / 1024 / 1024 / 1024) + " GB saved"} value={Math.round(totalDedup / 1024 / 1024 / 1024) + " GB"} status="good" />
        <StatCard label="Compression" icon={<Zap className="size-5" />} detail={Math.round(totalCompression / 1024 / 1024 / 1024) + " GB saved"} value={Math.round(totalCompression / 1024 / 1024 / 1024) + " GB"} status="good" />
      </div>
    </div>
  );
}

// ========== SECURITY ==========
function SecuritySection({ dashboard }: { dashboard: BackupDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Shield className="size-5" />} subtitle="Ransomware protection, tampering detection, immutable backups" title="Ransomware Protection & Security" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickBox label="Total Events" value={String(dashboard.securityEvents.length)} />
        <QuickBox label="Critical" value={String(dashboard.securityEvents.filter((e) => e.severity === "critical").length)} />
        <QuickBox label="Open" value={String(dashboard.securityEvents.filter((e) => e.mitigationStatus !== "resolved").length)} />
        <QuickBox label="Resolved" value={String(dashboard.securityEvents.filter((e) => e.mitigationStatus === "resolved").length)} />
      </div>
      {dashboard.securityEvents.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-0">
            {dashboard.securityEvents.slice(0, 15).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 border-b border-border p-4 text-sm last:border-0">
                <div className="flex items-center gap-2">
                  <SecBadge severity={e.severity} />
                  <p className="font-semibold">{formatAnalyticsLabel(e.type)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{e.description.slice(0, 60)}...</span>
                  <SecMitigationBadge status={e.mitigationStatus} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {dashboard.recentBackups.filter((b) => b.isImmutable).length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader><div className="flex items-center gap-2"><Lock className="size-5 text-green-700" /><h3 className="text-lg font-black text-green-800">Immutable Backups</h3></div></CardHeader>
          <CardContent><p className="text-sm">{dashboard.recentBackups.filter((b) => b.isImmutable).length} backups are immutable and cannot be modified or deleted</p></CardContent>
        </Card>
      )}
    </div>
  );
}
function SecBadge({ severity }: { severity: string }) {
  const c: Record<string, string> = { critical: "border-red-200 bg-red-50 text-red-700", high: "border-orange-200 bg-orange-50 text-orange-700", medium: "border-amber-200 bg-amber-50 text-amber-800" };
  return <Badge className={c[severity] ?? ""}>{formatAnalyticsLabel(severity)}</Badge>;
}
function SecMitigationBadge({ status }: { status: string }) {
  const c: Record<string, string> = { resolved: "border-green-200 bg-green-50 text-green-700", contained: "border-blue-200 bg-blue-50 text-blue-700", investigating: "border-amber-200 bg-amber-50 text-amber-800", open: "border-red-200 bg-red-50 text-red-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

// ========== SCHEDULES ==========
function SchedulesSection({ dashboard }: { dashboard: BackupDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Clock className="size-5" />} subtitle="Automated backup scheduling with smart scheduling" title="Backup Scheduling" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.schedules.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{s.name}</p>
                <Badge className={s.isActive ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}>{s.isActive ? "Active" : "Paused"}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatAnalyticsLabel(s.frequency)} · {formatAnalyticsLabel(s.backupType)} · {s.scope}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Retention</p><p className="font-semibold">{s.retentionDays} days</p></div>
                <div><p className="text-xs text-muted-foreground">Storage Tier</p><TierBadge tier={s.storageTier} /></div>
                <div><p className="text-xs text-muted-foreground">Last Run</p><p className="font-semibold">{s.lastRunAt ? new Date(s.lastRunAt).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Next Run</p><p className="font-semibold">{s.nextRunAt ? new Date(s.nextRunAt).toLocaleDateString() : "—"}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
        {dashboard.schedules.length === 0 && <div className="xl:col-span-3"><EmptyState text="No backup schedules configured" /></div>}
      </div>
    </div>
  );
}

// ========== PITR ==========
function PitrSection({ dashboard }: { dashboard: BackupDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<RefreshCcw className="size-5" />} subtitle="Point-in-time recovery points by granularity" title="Point-In-Time Recovery" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.pitrPoints.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{formatAnalyticsLabel(p.resourceType)}</p>
                <PitrGranularityBadge granularity={p.granularity} />
              </div>
              <p className="mt-2 text-lg font-black tabular-nums">{new Date(p.recoveryTimestamp).toLocaleString("en-IN")}</p>
              <Badge className={p.isAvailable ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>{p.isAvailable ? "Available" : "Unavailable"}</Badge>
            </CardContent>
          </Card>
        ))}
        {dashboard.pitrPoints.length === 0 && <div className="xl:col-span-3"><EmptyState text="No PITR points available" /></div>}
      </div>
    </div>
  );
}
function PitrGranularityBadge({ granularity }: { granularity: string }) {
  const c: Record<string, string> = { exact_timestamp: "border-green-200 bg-green-50 text-green-700", minute: "border-blue-200 bg-blue-50 text-blue-700", hour: "border-amber-200 bg-amber-50 text-amber-800", daily: "border-purple-200 bg-purple-50 text-purple-700", weekly: "border-gray-200 bg-gray-50 text-gray-700" };
  return <Badge className={c[granularity] ?? ""}>{formatAnalyticsLabel(granularity)}</Badge>;
}

// ========== COMPLIANCE ==========
function ComplianceSection({ dashboard }: { dashboard: BackupDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<FileText className="size-5" />} subtitle="GDPR, SOC 2, ISO 27001 backup compliance reports" title="Compliance Reporting" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.complianceReports.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{r.title}</p>
                <CompStatusBadge status={r.status} />
              </div>
              <p className="text-xs text-muted-foreground">{formatAnalyticsLabel(r.type)}</p>
              <p className="mt-2 text-sm">{r.periodStart} → {r.periodEnd}</p>
              {r.generatedAt && <p className="mt-1 text-xs text-muted-foreground">Generated: {new Date(r.generatedAt).toLocaleString()}</p>}
            </CardContent>
          </Card>
        ))}
        {dashboard.complianceReports.length === 0 && <div className="xl:col-span-3"><EmptyState text="No compliance reports generated" /></div>}
      </div>
    </div>
  );
}
function CompStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { completed: "border-green-200 bg-green-50 text-green-700", generating: "border-blue-200 bg-blue-50 text-blue-700", failed: "border-red-200 bg-red-50 text-red-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

// ========== APPROVALS ==========
function ApprovalsSection({ dashboard }: { dashboard: BackupDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<ShieldCheck className="size-5" />} subtitle="Multi-level approval workflow for recovery operations" title="Approval & Change Control" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickBox label="Pending" value={String(dashboard.approvals.filter((a) => a.status === "pending").length)} />
        <QuickBox label="Approved" value={String(dashboard.approvals.filter((a) => a.status === "approved").length)} />
        <QuickBox label="Rejected" value={String(dashboard.approvals.filter((a) => a.status === "rejected").length)} />
        <QuickBox label="MFA Verified" value={String(dashboard.approvals.filter((a) => a.mfaVerified).length)} />
      </div>
      {dashboard.approvals.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-0">
            {dashboard.approvals.slice(0, 15).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 border-b border-border p-4 text-sm last:border-0">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">L{a.level}</span>
                  <p className="font-semibold">{formatAnalyticsLabel(a.role)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ApprovalStatusBadge status={a.status} />
                  {a.mfaVerified && <Badge className="border-green-200 bg-green-50 text-green-700">MFA</Badge>}
                  {a.respondedAt && <span className="text-xs text-muted-foreground">{new Date(a.respondedAt).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function ApprovalStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { approved: "border-green-200 bg-green-50 text-green-700", rejected: "border-red-200 bg-red-50 text-red-700", pending: "border-amber-200 bg-amber-50 text-amber-800", escalated: "border-orange-200 bg-orange-50 text-orange-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

// ========== DR ==========
function DrSection({ dashboard }: { dashboard: BackupDashboard }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<HeartPulse className="size-5" />} subtitle="Disaster recovery plans, RTO/RPO, failover status" title="Disaster Recovery Center" />
      <div className="grid gap-5 xl:grid-cols-2">
        {dashboard.drStatus.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xl font-black">{d.planName}</p>
                <DrStatusBadge status={d.status} />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-6">
                <div className="rounded-lg border border-border bg-background p-4"><p className="text-xs text-muted-foreground">RTO</p><p className="text-3xl font-black">{d.estimatedRto ?? "—"} <span className="text-sm font-normal text-muted-foreground">min</span></p></div>
                <div className="rounded-lg border border-border bg-background p-4"><p className="text-xs text-muted-foreground">RPO</p><p className="text-3xl font-black">{d.estimatedRpo ?? "—"} <span className="text-sm font-normal text-muted-foreground">min</span></p></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${d.hasAutoFailover ? "bg-green-500" : "bg-gray-400"}`} /><span className="font-semibold">Auto-failover: {d.hasAutoFailover ? "Enabled" : "Disabled"}</span></div>
                <div className="flex items-center gap-2"><Globe2 className="size-4 text-muted-foreground" /><span className="font-semibold">Secondary: {d.secondaryRegion ?? "None"}</span></div>
              </div>
              {d.lastTestedAt && <p className="mt-4 text-xs text-muted-foreground">Last DR test: {new Date(d.lastTestedAt).toLocaleDateString("en-IN")}</p>}
            </CardContent>
          </Card>
        ))}
        {dashboard.drStatus.length === 0 && <EmptyState text="No DR plan configured" />}
      </div>
    </div>
  );
}
function DrStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { ready: "border-green-200 bg-green-50 text-green-700", tested: "border-blue-200 bg-blue-50 text-blue-700", in_progress: "border-amber-200 bg-amber-50 text-amber-800", failed: "border-red-200 bg-red-50 text-red-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}
