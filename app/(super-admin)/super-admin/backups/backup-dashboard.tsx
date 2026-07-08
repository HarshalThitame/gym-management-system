"use client";

import {
  Activity, AlertTriangle, Check, CheckCircle2, Clock, Database, FileText, Gauge,
  Globe2, HeartPulse, Inbox, Loader2, Lock, LockKeyhole, Plus, RefreshCcw, RotateCcw,
  Server, ShieldCheck, Shield, ShieldAlert, Trash2, TrendingUp, X, Zap, Edit3,
  Search,   ArrowRight, Info
} from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { showToast } from "@/components/ui/toast";
import type { AuthContext } from "@/types/auth";
import type { BackupDashboard } from "@/features/backup/services/backup-service";
import { formatAnalyticsLabel, formatCompactNumber } from "@/features/analytics/lib/business-rules";
import {
  startBackupAction,
  deleteBackupAction,
  initiateRecoveryAction,
  approveRecoveryAction,
  saveBackupScheduleAction,
  deleteBackupScheduleAction,
  runBackupVerificationAction,
  generateComplianceReportAction,
} from "@/features/backup/actions/backup-actions";

type Props = { context: AuthContext; dashboard: BackupDashboard };
type TabId = "overview" | "backups" | "recovery" | "replication" | "verification" | "storage" | "security" | "schedules" | "pitr" | "compliance" | "approvals" | "dr";

export function BackupDashboardClient({ context: _ctx, dashboard }: Props) {
  void _ctx;
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showCreateBackup, setShowCreateBackup] = useState(false);
  const [showRecoveryWizard, setShowRecoveryWizard] = useState(false);
  const [showDeleteBackup, setShowDeleteBackup] = useState<string | null>(null);
  const [restoreBackupId, setRestoreBackupId] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState<string | null>(null);
  const [showDeleteSchedule, setShowDeleteSchedule] = useState<string | null>(null);
  const [showRunVerification, setShowRunVerification] = useState(false);
  const [showComplianceReport, setShowComplianceReport] = useState(false);
  const [showPitrRestore, setShowPitrRestore] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState<{ id: string; action: "approve" | "reject" | "escalate" } | null>(null);
  const triggerRefresh = useCallback(() => {
    showToast("Dashboard updated.", "success");
  }, []);

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

  const dbUnavailable = dashboard.executive.totalBackups === 0 && dashboard.recentBackups.length === 0 && dashboard.storageTiers.length === 0;

  return (
    <div className="space-y-6">
      {dbUnavailable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          <AlertTriangle className="mr-2 inline size-4" />
          Backup dashboard data unavailable — check database connectivity
        </div>
      )}
      <HeaderSection dashboard={dashboard} onCreateBackup={() => setShowCreateBackup(true)} onNewRecovery={() => setShowRecoveryWizard(true)} />
      <TabBar tabs={tabs} active={activeTab} onSelect={setActiveTab} />
      {activeTab === "overview" && <OverviewSection dashboard={dashboard} />}
      {activeTab === "backups" && <BackupsSection dashboard={dashboard} onDelete={(id) => setShowDeleteBackup(id)} onRestore={(id) => { setRestoreBackupId(id); setShowRecoveryWizard(true); }} />}
      {activeTab === "recovery" && <RecoverySection dashboard={dashboard} />}
      {activeTab === "replication" && <ReplicationSection dashboard={dashboard} />}
      {activeTab === "verification" && <VerificationSection dashboard={dashboard} onRunVerification={() => setShowRunVerification(true)} />}
      {activeTab === "storage" && <StorageSection dashboard={dashboard} />}
      {activeTab === "security" && <SecuritySection dashboard={dashboard} />}
      {activeTab === "schedules" && <SchedulesSection dashboard={dashboard} onEdit={(id) => setShowScheduleForm(id)} onDelete={(id) => setShowDeleteSchedule(id)} onCreate={() => setShowScheduleForm("new")} />}
      {activeTab === "pitr" && <PitrSection dashboard={dashboard} onRestore={(id) => setShowPitrRestore(id)} />}
      {activeTab === "compliance" && <ComplianceSection dashboard={dashboard} onGenerate={() => setShowComplianceReport(true)} />}
      {activeTab === "approvals" && <ApprovalsSection dashboard={dashboard} onAction={(id, action) => setShowApprovalModal({ id, action })} />}
      {activeTab === "dr" && <DrSection dashboard={dashboard} />}

      {showCreateBackup && <CreateBackupModal onClose={() => setShowCreateBackup(false)} onSuccess={triggerRefresh} />}
      {showRecoveryWizard && <RecoveryWizardModal dashboard={dashboard} preselectedBackupId={restoreBackupId} onClose={() => { setShowRecoveryWizard(false); setRestoreBackupId(null); }} onSuccess={triggerRefresh} />}
      {showDeleteBackup && <DeleteBackupModal backupId={showDeleteBackup} onClose={() => setShowDeleteBackup(null)} onSuccess={triggerRefresh} />}
      {showScheduleForm && <BackupScheduleFormModal scheduleId={showScheduleForm === "new" ? null : showScheduleForm} dashboard={dashboard} onClose={() => setShowScheduleForm(null)} onSuccess={triggerRefresh} />}
      {showDeleteSchedule && <DeleteScheduleModal scheduleId={showDeleteSchedule} onClose={() => setShowDeleteSchedule(null)} onSuccess={triggerRefresh} />}
      {showRunVerification && <RunVerificationModal dashboard={dashboard} onClose={() => setShowRunVerification(false)} onSuccess={triggerRefresh} />}
      {showComplianceReport && <GenerateComplianceReportModal onClose={() => setShowComplianceReport(false)} onSuccess={triggerRefresh} />}
      {showPitrRestore && <PitrRestoreModal pitrPointId={showPitrRestore} dashboard={dashboard} onClose={() => setShowPitrRestore(null)} onSuccess={triggerRefresh} />}
      {showApprovalModal && <ApprovalActionModal approvalId={showApprovalModal.id} action={showApprovalModal.action} onClose={() => setShowApprovalModal(null)} onSuccess={triggerRefresh} />}
    </div>
  );
}

// ========== HEADER ==========
function HeaderSection({ dashboard, onCreateBackup, onNewRecovery }: { dashboard: BackupDashboard; onCreateBackup: () => void; onNewRecovery: () => void }) {
  const e = dashboard.executive;
  const posture = e.drReadinessScore >= 90 ? "good" : e.drReadinessScore >= 70 ? "watch" : "risk";
  const pColors = { good: "border-green-200 bg-green-50 text-green-700", watch: "border-amber-200 bg-amber-50 text-amber-800", risk: "border-red-200 bg-red-50 text-red-700" };
  return (
    <div className="bg-background/90 backdrop-blur sticky top-0 z-10 border-b border-border -mx-5 px-5 py-4">
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
          <button onClick={onCreateBackup} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-black hover:-translate-y-0.5 transition-transform shadow-sm">
            <Plus className="size-4" />
            Create Backup
          </button>
          <button onClick={onNewRecovery} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-black hover:-translate-y-0.5 transition-transform shadow-sm">
            <Activity className="size-4" />
            New Recovery
          </button>
          <ButtonLink href="/super-admin/backups?tab=dr" variant="secondary" className="gap-2"><HeartPulse className="size-4" /> DR Status</ButtonLink>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricBox label="Total Backups" value={formatCompactNumber(e.totalBackups)} status={e.totalBackups > 0 ? "good" : "watch"} />
        <MetricBox label="Failed" value={formatCompactNumber(e.failedBackups)} status={e.failedBackups === 0 ? "good" : e.failedBackups < 5 ? "watch" : "risk"} />
        <MetricBox label="Recovery Rate" value={`${e.recoverySuccessRate}%`} status={e.recoverySuccessRate >= 99 ? "good" : e.recoverySuccessRate >= 90 ? "watch" : "risk"} />
        <MetricBox label="RPO / RTO" value={`${e.rpoMinutes}m / ${e.rtoMinutes}m`} status={e.rpoMinutes <= 5 && e.rtoMinutes <= 15 ? "good" : "watch"} />
        <MetricBox label="DR Readiness" value={`${e.drReadinessScore}%`} status={e.drReadinessScore >= 90 ? "good" : e.drReadinessScore >= 70 ? "watch" : "risk"} />
      </div>
    </div>
  );
}

function MetricBox({ label, value, status }: { label: string; value: string; status: "good" | "watch" | "risk" }) {
  const c = { good: "text-green-600 border-green-200 bg-green-50", watch: "text-amber-600 border-amber-200 bg-amber-50", risk: "text-red-600 border-red-200 bg-red-50" };
  return <div className={`rounded-xl border ${c[status]} p-4 dark:bg-background`}><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={`mt-2 text-3xl font-black ${c[status].split(" ")[0]}`}>{value}</p></div>;
}

// ========== TAB BAR ==========
function TabBar({ tabs, active, onSelect }: { tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; count?: number }>; active: string; onSelect: (id: TabId) => void }) {
  return (
    <div className="sticky top-[73px] z-[9] bg-background/80 backdrop-blur-sm border-b border-border -mx-5 px-5 pb-2">
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
    </div>
  );
}

function SectionHeader({ icon, subtitle, title, action }: { icon: React.ReactNode; subtitle: string; title: string; action?: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="rounded-md bg-primary/10 p-1.5 text-primary">{icon}</div><div><h2 className="text-2xl font-black">{title}</h2><p className="text-sm text-muted-foreground">{subtitle}</p></div></div>{action && <div className="shrink-0">{action}</div>}</div>;
}
function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-12 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-surface-muted">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-black">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action && (
        <div className="mt-6">
          <button onClick={action.onClick} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-black hover:-translate-y-0.5 transition-transform shadow-sm">
            <Plus className="size-4" />
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}

// ========== OVERVIEW ==========
function OverviewSection({ dashboard }: { dashboard: BackupDashboard }) {
  const e = dashboard.executive;
  const kpis = [
    { label: "Total Backups", value: formatCompactNumber(e.totalBackups), icon: <Database className="size-4" />, detail: `${e.successfulBackups} successful · ${e.failedBackups} failed`, status: e.failedBackups === 0 ? "good" as const : "watch" as const },
    { label: "Data Protected", value: formatCompactNumber(Math.round(e.dataProtectedBytes / 1024 / 1024 / 1024)) + " GB", icon: <Server className="size-4" />, detail: `${formatCompactNumber(Math.round(e.dataProtectedBytes / 1024 / 1024 / 1024))} GB total`, status: "good" as const },
    { label: "Storage Consumed", value: formatCompactNumber(Math.round(e.storageConsumedBytes / 1024 / 1024 / 1024)) + " GB", icon: <Inbox className="size-4" />, detail: `${formatCompactNumber(Math.round(e.storageConsumedBytes / 1024 / 1024 / 1024))} GB used`, status: "good" as const },
    { label: "Active Recovery", value: String(e.activeRecoveryJobs), icon: <Activity className="size-4" />, detail: `${e.activeRecoveryJobs} jobs in progress`, status: e.activeRecoveryJobs === 0 ? "good" as const : "watch" as const },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Gauge className="size-5" />} subtitle="Executive backup KPIs and real-time status" title="Global Backup Operations Dashboard" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <div key={kpi.label} className="reveal-up rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 transition-all hover:shadow-md hover:border-border-strong" style={{"--reveal-delay": `${i * 0.05}s`} as React.CSSProperties}>
            <div className="flex items-center gap-2"><div className="grid size-8 place-items-center rounded-md bg-accent/20">{kpi.icon}</div><div><div className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{kpi.label}</div><div className="text-2xl font-black text-foreground">{kpi.value}</div></div></div>
          </div>
        ))}
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
function BackupsSection({ dashboard, onDelete, onRestore }: { dashboard: BackupDashboard; onDelete: (id: string) => void; onRestore: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Database className="size-5" />} subtitle="Complete backup inventory" title="Enterprise Backup Catalog" />
      <div className="space-y-2">
        {dashboard.recentBackups.map((b) => (
          <div key={b.id} className="rounded-md border border-border bg-background p-4 transition-colors hover:bg-surface-muted">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`size-2 rounded-full ${
                  b.status === "completed" ? "bg-green-500" : b.status === "failed" ? "bg-red-500" : b.status === "running" ? "bg-amber-500 animate-pulse" : "bg-muted-foreground"
                }`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black">{b.type.toUpperCase()}</span>
                    <BackupStatusBadge status={b.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Math.round(b.sizeBytes / 1024 / 1024)} MB · {new Date(b.createdAt).toLocaleDateString()} · {b.scope} · {b.storageTier} · {b.encryptionStatus}
                    {b.isImmutable && <span className="ml-2 inline-flex items-center gap-1 text-green-600"><Lock className="size-3" />Immutable</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {b.status === "completed" && (
                  <button onClick={() => onRestore(b.id)} className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted transition-all grid place-items-center" title="Restore from this backup">
                    <RotateCcw className="size-4" />
                  </button>
                )}
                {(b.status === "completed" || b.status === "failed" || b.status === "cancelled") && (
                  <button onClick={() => onDelete(b.id)} className="size-8 rounded-md border border-border bg-background hover:bg-destructive/10 hover:border-destructive/30 text-destructive transition-all grid place-items-center" title="Delete backup">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {dashboard.recentBackups.length === 0 && <EmptyState icon={<Database className="size-8 text-muted-foreground" />} title="No backups yet" description="Create your first backup to protect your platform data." />}
      </div>
    </div>
  );
}

function BackupStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { completed: "border-green-200 bg-green-50 text-green-700", running: "border-blue-200 bg-blue-50 text-blue-700", queued: "border-amber-200 bg-amber-50 text-amber-800", failed: "border-red-200 bg-red-50 text-red-700", cancelled: "border-gray-200 bg-gray-50 text-gray-700" };
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
        {dashboard.replicationStatus.length === 0 && <div className="xl:col-span-3"><EmptyState icon={<Globe2 className="size-8 text-muted-foreground" />} title="No replication configured" description="Set up cross-region replication to ensure backup availability." /></div>}
      </div>
    </div>
  );
}
function ReplStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { synced: "border-green-200 bg-green-50 text-green-700", syncing: "border-blue-200 bg-blue-50 text-blue-700", lagging: "border-amber-200 bg-amber-50 text-amber-800", failed: "border-red-200 bg-red-50 text-red-700", not_configured: "border-gray-200 bg-gray-50 text-gray-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

// ========== VERIFICATION ==========
function VerificationSection({ dashboard, onRunVerification }: { dashboard: BackupDashboard; onRunVerification: () => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<CheckCircle2 className="size-5" />} subtitle="Automated backup integrity verification" title="Backup Verification & Validation"
        action={<button onClick={onRunVerification} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-black hover:-translate-y-0.5 transition-transform shadow-sm"><Plus className="size-4" />Run Verification</button>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickBox label="Total Checks" value={String(dashboard.verifications.length)} />
        <QuickBox label="Passed" value={String(dashboard.verifications.filter((v) => v.status === "passed").length)} />
        <QuickBox label="Failed" value={String(dashboard.verifications.filter((v) => v.status === "failed").length)} />
        <QuickBox label="In Progress" value={String(dashboard.verifications.filter((v) => v.status === "in_progress").length)} />
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
      {dashboard.verifications.length === 0 && (
        <EmptyState icon={<CheckCircle2 className="size-8 text-muted-foreground" />} title="No verifications yet" description="Run a verification check to ensure backup integrity." action={{ label: "Run Verification", onClick: onRunVerification }} />
      )}
    </div>
  );
}
function VerifIcon({ status }: { status: string }) {
  const c: Record<string, string> = { passed: "text-green-600", failed: "text-red-600", pending: "text-amber-600", in_progress: "text-blue-600" };
  return <span className={`size-2 rounded-full ${c[status] ?? "bg-gray-400"}`} />;
}
function VerifBadge({ status }: { status: string }) {
  const c: Record<string, string> = { passed: "border-green-200 bg-green-50 text-green-700", failed: "border-red-200 bg-red-50 text-red-700", pending: "border-amber-200 bg-amber-50 text-amber-800", in_progress: "border-blue-200 bg-blue-50 text-blue-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
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
function SchedulesSection({ dashboard, onEdit, onDelete, onCreate }: { dashboard: BackupDashboard; onEdit: (id: string) => void; onDelete: (id: string) => void; onCreate: () => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<Clock className="size-5" />} subtitle="Automated backup scheduling with smart scheduling" title="Backup Scheduling"
        action={<button onClick={onCreate} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-black hover:-translate-y-0.5 transition-transform shadow-sm"><Plus className="size-4" />Create Schedule</button>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.schedules.map((s) => (
          <div key={s.id} className={`rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 border-l-4 ${s.isActive ? "border-l-green-500" : "border-l-gray-400"}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-black">{s.name}</p>
              <Badge className={s.isActive ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}>{s.isActive ? "Active" : "Paused"}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{formatAnalyticsLabel(s.frequency)} · {formatAnalyticsLabel(s.backupType)} · {s.scope}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Retention</p><p className="font-semibold">{s.retentionDays} days</p></div>
              <div><p className="text-xs text-muted-foreground">Storage</p><TierBadge tier={s.storageTier} /></div>
              <div><p className="text-xs text-muted-foreground">Last Run</p><p className="font-semibold">{s.lastRunAt ? new Date(s.lastRunAt).toLocaleDateString() : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Next Run</p><p className="font-semibold">{s.nextRunAt ? new Date(s.nextRunAt).toLocaleDateString() : "—"}</p></div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => onEdit(s.id)} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-muted transition-colors"><Edit3 className="size-3.5" /> Edit</button>
              <button onClick={() => onDelete(s.id)} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors"><Trash2 className="size-3.5" /> Delete</button>
            </div>
          </div>
        ))}
        {dashboard.schedules.length === 0 && <div className="xl:col-span-3"><EmptyState icon={<Clock className="size-8 text-muted-foreground" />} title="No schedules yet" description="Create automated backup schedules for regular protection." action={{ label: "Create Schedule", onClick: onCreate }} /></div>}
      </div>
    </div>
  );
}
function TierBadge({ tier }: { tier: string }) {
  const c: Record<string, string> = { hot: "bg-red-50 text-red-700 border-red-200", warm: "bg-amber-50 text-amber-800 border-amber-200", cold: "bg-blue-50 text-blue-700 border-blue-200", archive: "bg-purple-50 text-purple-700 border-purple-200" };
  return <Badge className={c[tier] ?? ""}>{tier}</Badge>;
}

// ========== PITR ==========
function PitrSection({ dashboard, onRestore }: { dashboard: BackupDashboard; onRestore: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<RefreshCcw className="size-5" />} subtitle="Point-in-time recovery points by granularity" title="Point-In-Time Recovery" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.pitrPoints.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black">{formatAnalyticsLabel(p.resourceType)}</p>
              <PitrGranularityBadge granularity={p.granularity} />
            </div>
            <p className="mt-2 text-lg font-black tabular-nums">{new Date(p.recoveryTimestamp).toLocaleString("en-IN")}</p>
            <div className="mt-3 flex items-center justify-between">
              <Badge className={p.isAvailable ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>{p.isAvailable ? "Available" : "Unavailable"}</Badge>
              {p.isAvailable && (
                <button onClick={() => onRestore(p.id)} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-muted transition-colors"><RotateCcw className="size-3.5" /> Restore</button>
              )}
            </div>
          </div>
        ))}
        {dashboard.pitrPoints.length === 0 && <div className="xl:col-span-3"><EmptyState icon={<RefreshCcw className="size-8 text-muted-foreground" />} title="No PITR points available" description="Point-in-time recovery points will appear after backups are completed." /></div>}
      </div>
    </div>
  );
}
function PitrGranularityBadge({ granularity }: { granularity: string }) {
  const c: Record<string, string> = { exact_timestamp: "border-green-200 bg-green-50 text-green-700", minute: "border-blue-200 bg-blue-50 text-blue-700", hour: "border-amber-200 bg-amber-50 text-amber-800", daily: "border-purple-200 bg-purple-50 text-purple-700", weekly: "border-gray-200 bg-gray-50 text-gray-700" };
  return <Badge className={c[granularity] ?? ""}>{formatAnalyticsLabel(granularity)}</Badge>;
}

// ========== COMPLIANCE ==========
function ComplianceSection({ dashboard, onGenerate }: { dashboard: BackupDashboard; onGenerate: () => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={<FileText className="size-5" />} subtitle="GDPR, SOC 2, ISO 27001 backup compliance reports" title="Compliance Reporting"
        action={<button onClick={onGenerate} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-black hover:-translate-y-0.5 transition-transform shadow-sm"><Plus className="size-4" />Generate Report</button>}
      />
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
        {dashboard.complianceReports.length === 0 && <div className="xl:col-span-3"><EmptyState icon={<FileText className="size-8 text-muted-foreground" />} title="No reports yet" description="Generate compliance reports for GDPR, SOC 2, HIPAA, and more." /></div>}
      </div>
    </div>
  );
}
function CompStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { completed: "border-green-200 bg-green-50 text-green-700", generating: "border-blue-200 bg-blue-50 text-blue-700", failed: "border-red-200 bg-red-50 text-red-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

// ========== APPROVALS ==========
function ApprovalsSection({ dashboard, onAction }: { dashboard: BackupDashboard; onAction: (id: string, action: "approve" | "reject" | "escalate") => void }) {
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
        <div className="space-y-2">
          {dashboard.approvals.slice(0, 15).map((a, i) => (
            <div key={a.id} className="reveal-up rounded-lg border border-border bg-surface p-4 space-y-3" style={{"--reveal-delay": `${i * 0.05}s`} as React.CSSProperties}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">L{a.level}</span>
                    <span className="text-sm font-black">{formatAnalyticsLabel(a.role)}</span>
                    <ApprovalStatusBadge status={a.status} />
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Level {a.level}/4</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Recovery: {a.recoverySessionId.slice(0, 8)}</p>
                </div>
                {a.status === "pending" && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => onAction(a.id, "approve")} className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100 transition-colors">Approve</button>
                    <button onClick={() => onAction(a.id, "reject")} className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors">Reject</button>
                    <button onClick={() => onAction(a.id, "escalate")} className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors">Escalate</button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                {[1, 2, 3, 4].map((level) => {
                  const isPending = level === a.level && a.status === "pending";
                  const isDone = level < a.level || (level === a.level && (a.status === "approved" || a.status === "escalated"));
                  return (
                    <div key={level} className="flex items-center gap-1">
                      <div className={`size-5 rounded-full grid place-items-center text-[9px] font-black ${
                        isDone ? "bg-green-500 text-white" : isPending ? "bg-accent text-accent-foreground ring-2 ring-accent/30" : "bg-surface-muted text-muted-foreground"
                      }`}>
                        {isDone ? <Check className="size-3" /> : level}
                      </div>
                      {level < 4 && <div className={`w-5 h-px ${isDone ? "bg-green-400" : "bg-border"}`} />}
                    </div>
                  );
                })}
              </div>
              {a.mfaVerified && <Badge className="border-green-200 bg-green-50 text-green-700"><LockKeyhole className="mr-1 size-3" />MFA</Badge>}
              {a.respondedAt && <p className="text-xs text-muted-foreground">Responded: {new Date(a.respondedAt).toLocaleDateString()}</p>}
            </div>
          ))}
        </div>
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
        {dashboard.drStatus.length === 0 && <EmptyState icon={<HeartPulse className="size-8 text-muted-foreground" />} title="No DR plan configured" description="Set up disaster recovery plans to ensure business continuity." />}
      </div>
    </div>
  );
}
function DrStatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { ready: "border-green-200 bg-green-50 text-green-700", tested: "border-blue-200 bg-blue-50 text-blue-700", in_progress: "border-amber-200 bg-amber-50 text-amber-800", failed: "border-red-200 bg-red-50 text-red-700" };
  return <Badge className={c[status] ?? ""}>{formatAnalyticsLabel(status)}</Badge>;
}

// ========== MODALS ==========

function ModalShell({ title, onClose, children, maxW = "max-w-lg" }: { title: string; onClose: () => void; children: React.ReactNode; maxW?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm p-4">
      <div className={`w-full ${maxW} rounded-lg border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-background/50 sticky top-0 z-10">
          <h2 className="text-lg font-black">{title}</h2>
          <button onClick={onClose} className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted grid place-items-center">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StepIndicator({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`size-7 rounded-full grid place-items-center text-xs font-black transition-all duration-300 ${
            i <= currentStep ? "bg-accent text-accent-foreground scale-100" : "bg-surface-muted text-muted-foreground scale-90"
          }`}>
            {i < currentStep ? <Check className="size-3.5" /> : i + 1}
          </div>
          <span className={`text-xs font-black ${i === currentStep ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
          {i < steps.length - 1 && <div className={`w-8 h-px ${i < currentStep ? "bg-accent" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

function SubmitButton({ label, pending, disabled }: { label: string; pending: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={pending || disabled} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-black hover:-translate-y-0.5 transition-transform shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {label}
    </button>
  );
}

// ========== CREATE BACKUP MODAL ==========
function CreateBackupModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(0);
  const [backupType, setBackupType] = useState<string>("database");
  const [scope, setScope] = useState<string>("platform");
  const [organizationId, setOrganizationId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [stepUpEmail, setStepUpEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = ["Scope", "Type", "Options", "Confirm"];

  const scopes = [
    { value: "platform", label: "Platform", desc: "Entire system" },
    { value: "tenant", label: "Tenant", desc: "Specific organization" },
    { value: "gym", label: "Gym", desc: "Specific gym" },
  ];

  const types = [
    { value: "database", label: "Database", desc: "Full database snapshot" },
    { value: "files", label: "Files", desc: "File storage backup" },
    { value: "configuration", label: "Configuration", desc: "System config backup" },
    { value: "full", label: "Full", desc: "Complete system backup" },
  ];

  async function handleSubmit() {
    if (!stepUpEmail) {
      setError("Step-up email is required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await startBackupAction({
        backupType,
        scope,
        organizationId: scope === "platform" ? undefined : organizationId || undefined,
        branchId: scope === "branch" ? branchId || undefined : undefined,
        reason,
        stepUpEmail,
      });
      if (result.status === "success") {
        showToast(result.message || "Backup started!", "success");
        onSuccess();
        onClose();
      } else {
        setError(result.message || "Failed to start backup.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start backup.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ModalShell title="Create Backup" onClose={onClose}>
      <StepIndicator steps={steps} currentStep={step} />
      <div className="p-5 space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}

        {step === 0 && (
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Scope</label>
            <div className="grid grid-cols-3 gap-2">
              {scopes.map((s) => (
                <button key={s.value} onClick={() => { setScope(s.value); setOrganizationId(""); setBranchId(""); }}
                  className={`rounded-md border p-3 text-center transition-all ${
                    scope === s.value ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-background hover:bg-surface-muted"
                  }`}>
                  <span className="block text-xs font-black">{s.label}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{s.desc}</span>
                </button>
              ))}
            </div>
            {scope !== "platform" && (
              <div className="mt-3">
                <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Organization ID</label>
                <input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} placeholder="org_..." className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </div>
            )}
            {scope === "branch" && (
              <div className="mt-3">
                <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Gym ID</label>
                <input value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="gym_..." className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Backup Type</label>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => (
                <button key={t.value} onClick={() => setBackupType(t.value)}
                  className={`rounded-md border p-3 text-center transition-all ${
                    backupType === t.value ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-background hover:bg-surface-muted"
                  }`}>
                  <span className="block text-xs font-black">{t.label}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reason</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why is this backup needed?" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
              <p className="text-[10px] text-muted-foreground">{reason.length}/1000 · min 10 chars</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">MFA Step-Up Email</label>
              <input value={stepUpEmail} onChange={(e) => setStepUpEmail(e.target.value)} type="email" placeholder="superadmin@example.com" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-background p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Scope</span><span className="font-bold">{scope}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Type</span><span className="font-bold">{backupType}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Reason</span><span className="font-bold text-sm">{reason.slice(0, 60)}{reason.length > 60 ? "..." : ""}</span></div>
            </div>
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-xs font-black text-destructive flex items-center gap-2"><ShieldAlert className="size-4" /> Type <span className="font-mono">BACKUP</span> to confirm</p>
              <input placeholder='Type "BACKUP" to confirm' className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono" id="create-backup-confirm" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-background/50">
        <button onClick={() => step > 0 ? setStep(step - 1) : onClose()} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted">
          {step > 0 ? "Back" : "Cancel"}
        </button>
        {step < 3 ? (
          <button onClick={() => {
            if (step === 0 && scope !== "platform" && !organizationId) { setError("Organization ID is required for tenant/branch scope."); return; }
            if (step === 0 && scope === "branch" && !branchId) { setError("Gym ID is required for branch scope."); return; }
            setError(null); setStep(step + 1);
          }} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-black">
            Next <ArrowRight className="size-4" />
          </button>
        ) : (
          <SubmitButton pending={pending} label="Start Backup" disabled={!reason || reason.length < 10 || !stepUpEmail} />
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); const el = document.getElementById("create-backup-confirm") as HTMLInputElement; if (el?.value !== "BACKUP") { setError('Type "BACKUP" to confirm.'); return; } handleSubmit(); }} />
    </ModalShell>
  );
}

// ========== DELETE BACKUP MODAL ==========
function DeleteBackupModal({ backupId, onClose, onSuccess }: { backupId: string; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState("");
  const [stepUpEmail, setStepUpEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expectedConfirm = `DELETE_BACKUP:${backupId.slice(0, 8)}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmText !== expectedConfirm) {
      setError(`Type "${expectedConfirm}" to confirm.`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await deleteBackupAction({ backupId, reason, stepUpEmail });
      if (result.status === "success") {
        showToast("Backup deleted.", "success");
        onSuccess();
        onClose();
      } else {
        setError(result.message || "Failed to delete backup.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete backup.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ModalShell title="Delete Backup" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="size-5" /><p className="text-sm font-black">Warning</p></div>
          <p className="text-xs text-muted-foreground">This will permanently remove this backup. This action cannot be undone.</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Backup ID</p>
          <p className="font-mono text-sm font-black">{backupId}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why are you deleting this backup?" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">MFA Step-Up Email</label>
          <input value={stepUpEmail} onChange={(e) => setStepUpEmail(e.target.value)} type="email" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" required />
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <p className="text-xs font-black text-destructive">Type <span className="font-mono">{expectedConfirm}</span> to confirm</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={expectedConfirm} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono" />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted">Cancel</button>
          <SubmitButton pending={pending} label="Delete Backup" disabled={!reason || reason.length < 10 || confirmText !== expectedConfirm || !stepUpEmail} />
        </div>
      </form>
    </ModalShell>
  );
}

// ========== RECOVERY WIZARD ==========
function RecoveryWizardModal({ dashboard, preselectedBackupId, onClose, onSuccess }: { dashboard: BackupDashboard; preselectedBackupId?: string | null; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(preselectedBackupId ? 1 : 0);
  const [selectedBackupId, setSelectedBackupId] = useState(preselectedBackupId ?? "");
  const [recoveryType, setRecoveryType] = useState("full_platform");
  const [scope, setScope] = useState("platform");
  const [organizationId, setOrganizationId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [pitrPointId, setPitrPointId] = useState("");
  const [useLatest, setUseLatest] = useState(true);
  const [stepUpEmail, setStepUpEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const steps = ["Backup", "Type", "Scope", "Recovery Point", "Impact", "Approval", "Confirm"];
  const completedBackups = dashboard.recentBackups.filter((b) => b.status === "completed");
  const filteredBackups = completedBackups.filter((b) => b.id.includes(searchQuery) || b.type.includes(searchQuery) || b.scope.includes(searchQuery));
  const selectedBackup = completedBackups.find((b) => b.id === selectedBackupId);

  const recoveryTypes = [
    { value: "full_platform", label: "Full Platform" },
    { value: "database", label: "Database" },
    { value: "storage", label: "Storage" },
    { value: "tenant", label: "Tenant" },
    { value: "gym", label: "Gym" },
    { value: "membership_data", label: "Membership Data" },
    { value: "payment_data", label: "Payment Data" },
    { value: "user_data", label: "User Data" },
    { value: "configuration_data", label: "Configuration Data" },
    { value: "billing_data", label: "Billing Data" },
  ];

  const pitrPointsForScope = dashboard.pitrPoints.filter(
    (p) => scope === "platform" || p.resourceType === scope || p.resourceType === "full_platform"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const expectedConfirm = `RECOVER:${selectedBackupId.slice(0, 8)}`;
    if (confirmText !== expectedConfirm) {
      setError(`Type "${expectedConfirm}" to confirm.`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const selectedPitr = pitrPointsForScope.find((p) => p.id === pitrPointId);
      const result = await initiateRecoveryAction({
        backupId: selectedBackupId,
        recoveryType: recoveryType as any,
        scope: scope as any,
        organizationId: scope !== "platform" ? organizationId || undefined : undefined,
        branchId: scope === "branch" ? branchId || undefined : undefined,
        pitrPointId: useLatest ? undefined : pitrPointId || undefined,
        pitrTimestamp: useLatest ? undefined : selectedPitr?.recoveryTimestamp,
        stepUpEmail,
      });
      if (result.status === "success") {
        showToast(result.message || "Recovery initiated!", "success");
        onSuccess();
        onClose();
      } else {
        setError(result.message || "Failed to initiate recovery.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate recovery.");
    } finally {
      setPending(false);
    }
  }

  const impactAnalysis = selectedBackup ? {
    affectedRecords: Math.round(selectedBackup.sizeBytes / 1024 / 10),
    estimatedDowntime: selectedBackup.sizeBytes > 1073741824 ? 30 : selectedBackup.sizeBytes > 524288000 ? 15 : 5,
    scopeDescription: scope === "platform" ? "All organizations and branches" : scope === "tenant" ? `Organization ${organizationId}` : `Branch ${branchId}`,
  } : null;

  return (
    <ModalShell title="New Recovery" onClose={onClose} maxW="max-w-2xl">
      <StepIndicator steps={steps} currentStep={step} />
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}

        {step === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search backups..." className="flex-1 bg-transparent text-sm outline-none" />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredBackups.map((b) => (
                <button key={b.id} type="button" onClick={() => setSelectedBackupId(b.id)}
                  className={`w-full rounded-md border p-3 text-left transition-all ${selectedBackupId === b.id ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-background hover:bg-surface-muted"}`}>
                  <div className="flex items-center justify-between">
                    <div><span className="text-sm font-black">{b.type.toUpperCase()}</span><span className="ml-2 text-xs text-muted-foreground">{b.scope}</span></div>
                    <span className="text-xs text-muted-foreground">{Math.round(b.sizeBytes / 1024 / 1024)} MB</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString("en-IN")} · {b.storageTier} · {b.encryptionStatus} · {b.verificationStatus}</p>
                </button>
              ))}
              {filteredBackups.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No completed backups found</p>}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-2">
            {recoveryTypes.map((rt) => (
              <button key={rt.value} type="button" onClick={() => setRecoveryType(rt.value)}
                className={`rounded-md border p-3 text-center transition-all ${recoveryType === rt.value ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-background hover:bg-surface-muted"}`}>
                <span className="text-xs font-black">{rt.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Scope</label>
              <div className="flex gap-2">
                {["platform", "tenant", "branch"].map((s) => (
                  <button key={s} type="button" onClick={() => { setScope(s); setOrganizationId(""); setBranchId(""); }}
                    className={`rounded-md border px-4 py-2 text-xs font-black transition-all ${scope === s ? "border-accent bg-accent/5" : "border-border bg-background"}`}>{s}</button>
                ))}
              </div>
            </div>
            {scope !== "platform" && (
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Organization ID</label>
                <input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </div>
            )}
            {scope === "branch" && (
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Gym ID</label>
                <input value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setUseLatest(true)}
                className={`rounded-md border px-4 py-2 text-xs font-black transition-all ${useLatest ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-background"}`}>
                Latest
              </button>
              <button type="button" onClick={() => setUseLatest(false)}
                className={`rounded-md border px-4 py-2 text-xs font-black transition-all ${!useLatest ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-background"}`}>
                Specific Point
              </button>
            </div>
            {!useLatest && (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {pitrPointsForScope.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPitrPointId(p.id)}
                    className={`w-full rounded-md border p-3 text-left transition-all ${pitrPointId === p.id ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-background hover:bg-surface-muted"}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black">{formatAnalyticsLabel(p.resourceType)}</p>
                      <PitrGranularityBadge granularity={p.granularity} />
                    </div>
                    <p className="text-sm font-mono mt-1">{new Date(p.recoveryTimestamp).toLocaleString("en-IN")}</p>
                  </button>
                ))}
                {pitrPointsForScope.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No PITR points available for this scope</p>}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            {impactAnalysis && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-800"><Info className="size-4" /><p className="text-sm font-black">Impact Analysis</p></div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-white p-3 dark:bg-background"><p className="text-xs text-muted-foreground">Affected Records</p><p className="font-black">{impactAnalysis.affectedRecords.toLocaleString()}</p></div>
                  <div className="rounded-md bg-white p-3 dark:bg-background"><p className="text-xs text-muted-foreground">Est. Downtime</p><p className="font-black">{impactAnalysis.estimatedDowntime} min</p></div>
                  <div className="rounded-md bg-white p-3 dark:bg-background col-span-2"><p className="text-xs text-muted-foreground">Scope</p><p className="font-black">{impactAnalysis.scopeDescription}</p></div>
                </div>
                <p className="text-xs text-amber-700">Data changed after the recovery point will be rolled back. Ensure all stakeholders are notified before proceeding.</p>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <p className="text-sm font-black">Approval Required</p>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4].map((level) => (
                  <div key={level} className="flex items-center gap-1">
                    <div className={`size-7 rounded-full grid place-items-center text-xs font-black ${level === 1 ? "bg-accent text-accent-foreground" : "bg-surface-muted text-muted-foreground"}`}>
                      {level}
                    </div>
                    {level < 4 && <div className={`w-6 h-px ${level < 1 ? "bg-accent" : "bg-border"}`} />}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Level 1 approval (Super Admin) will be created. Higher levels may be required based on scope.</p>
              {scope !== "platform" && <Badge className="border-amber-200 bg-amber-50 text-amber-800">Level 2-4 may be needed for {scope} scope</Badge>}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">MFA Step-Up Email</label>
              <input value={stepUpEmail} onChange={(e) => setStepUpEmail(e.target.value)} type="email" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" required />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            {selectedBackup && (
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Backup</span><span className="font-bold">{selectedBackup.type.toUpperCase()} · {selectedBackup.id.slice(0, 8)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Recovery Type</span><span className="font-bold">{formatAnalyticsLabel(recoveryType)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Scope</span><span className="font-bold">{scope}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Recovery Point</span><span className="font-bold">{useLatest ? "Latest" : new Date((pitrPointsForScope.find((p) => p.id === pitrPointId)?.recoveryTimestamp ?? "")).toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Impact</span><span className="font-bold">{impactAnalysis?.affectedRecords.toLocaleString()} records · {impactAnalysis?.estimatedDowntime} min downtime</span></div>
              </div>
            )}
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-xs font-black text-destructive flex items-center gap-2"><ShieldAlert className="size-4" /> Type <span className="font-mono">RECOVER:{selectedBackupId.slice(0, 8)}</span> to confirm</p>
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={`RECOVER:${selectedBackupId.slice(0, 8)}`} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button type="button" onClick={() => step > 0 ? setStep(step - 1) : onClose()} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted">
            {step > 0 ? "Back" : "Cancel"}
          </button>
          {step < 6 ? (
            <button type="button" onClick={() => {
              if (step === 0 && !selectedBackupId) { setError("Select a backup to recover from."); return; }
              if (step === 4 && !impactAnalysis) { setError("Unable to calculate impact."); return; }
              if (step === 5 && !stepUpEmail) { setError("MFA step-up email is required for approval."); return; }
              setError(null); setStep(step + 1);
            }} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-black">
              Next <ArrowRight className="size-4" />
            </button>
          ) : (
            <SubmitButton pending={pending} label="Start Recovery" disabled={!selectedBackupId || !stepUpEmail || confirmText !== `RECOVER:${selectedBackupId.slice(0, 8)}`} />
          )}
        </div>
      </form>
    </ModalShell>
  );
}

// ========== BACKUP SCHEDULE FORM MODAL ==========
function BackupScheduleFormModal({ scheduleId, dashboard, onClose, onSuccess }: { scheduleId: string | null; dashboard: BackupDashboard; onClose: () => void; onSuccess: () => void }) {
  const existing = scheduleId ? dashboard.schedules.find((s) => s.id === scheduleId) : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [backupType, setBackupType] = useState(existing?.backupType ?? "database");
  const [frequency, setFrequency] = useState(existing?.frequency ?? "daily");
  const [customCron, setCustomCron] = useState("");
  const [retentionDays, setRetentionDays] = useState(existing?.retentionDays ?? 30);
  const [storageTier, setStorageTier] = useState(existing?.storageTier ?? "hot");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || name.length < 2) { setError("Name is required."); return; }
    setPending(true);
    setError(null);
    try {
      const result = await saveBackupScheduleAction({
        scheduleId: scheduleId ?? undefined,
        name,
        backupType: backupType as any,
        frequency: frequency as any,
        customCron: frequency === "custom_cron" ? customCron : undefined,
        retentionDays,
        storageTier: storageTier as any,
        isActive,
      });
      if (result.status === "success") {
        showToast(result.message || "Schedule saved.", "success");
        onSuccess();
        onClose();
      } else {
        setError(result.message || "Failed to save schedule.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ModalShell title={existing ? "Edit Schedule" : "Create Schedule"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        <div className="space-y-1">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Backup Type</label>
            <select value={backupType} onChange={(e) => setBackupType(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="database">Database</option>
              <option value="files">Files</option>
              <option value="configuration">Configuration</option>
              <option value="full">Full</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom_cron">Custom CRON</option>
            </select>
          </div>
        </div>
        {frequency === "custom_cron" && (
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">CRON Expression</label>
            <input value={customCron} onChange={(e) => setCustomCron(e.target.value)} placeholder="0 2 * * *" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Retention (days)</label>
            <input value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))} type="number" min={1} max={3650} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Storage Tier</label>
            <select value={storageTier} onChange={(e) => setStorageTier(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
              <option value="archive">Archive</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input id="schedule-active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-border" />
          <label htmlFor="schedule-active" className="text-sm font-semibold">Active</label>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted">Cancel</button>
          <SubmitButton pending={pending} label={existing ? "Update Schedule" : "Create Schedule"} />
        </div>
      </form>
    </ModalShell>
  );
}

// ========== DELETE SCHEDULE MODAL ==========
function DeleteScheduleModal({ scheduleId, onClose, onSuccess }: { scheduleId: string; onClose: () => void; onSuccess: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expectedConfirm = `DELETE_SCHEDULE:${scheduleId.slice(0, 8)}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmText !== expectedConfirm) {
      setError(`Type "${expectedConfirm}" to confirm.`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await deleteBackupScheduleAction({ scheduleId, stepUpEmail: "" });
      if (result.status === "success") {
        showToast("Schedule deleted.", "success");
        onSuccess();
        onClose();
      } else {
        setError(result.message || "Failed to delete schedule.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete schedule.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ModalShell title="Delete Schedule" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="size-5" /><p className="text-sm font-black">Warning</p></div>
          <p className="text-xs text-muted-foreground">This will permanently delete this schedule.</p>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <p className="text-xs font-black text-destructive">Type <span className="font-mono">{expectedConfirm}</span> to confirm</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={expectedConfirm} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono" />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted">Cancel</button>
          <SubmitButton pending={pending} label="Delete Schedule" disabled={confirmText !== expectedConfirm} />
        </div>
      </form>
    </ModalShell>
  );
}

// ========== RUN VERIFICATION MODAL ==========
function RunVerificationModal({ dashboard, onClose, onSuccess }: { dashboard: BackupDashboard; onClose: () => void; onSuccess: () => void }) {
  const [backupId, setBackupId] = useState("");
  const [verificationType, setVerificationType] = useState("completeness");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedBackups = dashboard.recentBackups.filter((b) => b.status === "completed");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!backupId) { setError("Select a backup."); return; }
    setPending(true);
    setError(null);
    try {
      const result = await runBackupVerificationAction({ backupId, verificationType: verificationType as any });
      if (result.status === "success") {
        showToast("Verification started.", "success");
        onSuccess();
        onClose();
      } else {
        setError(result.message || "Failed to start verification.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start verification.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ModalShell title="Run Verification" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        <div className="space-y-1">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Backup</label>
          <select value={backupId} onChange={(e) => setBackupId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">Select a backup...</option>
            {completedBackups.map((b) => (
              <option key={b.id} value={b.id}>{b.type.toUpperCase()} · {b.id.slice(0, 8)} · {new Date(b.createdAt).toLocaleDateString()}</option>
            ))}
          </select>
          {completedBackups.length === 0 && <p className="text-xs text-muted-foreground">No completed backups available</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Verification Type</label>
          <select value={verificationType} onChange={(e) => setVerificationType(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="completeness">Completeness</option>
            <option value="file_integrity">File Integrity</option>
            <option value="db_consistency">DB Consistency</option>
            <option value="encryption_validity">Encryption Validity</option>
            <option value="full_recovery_test">Full Recovery Test</option>
          </select>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted">Cancel</button>
          <SubmitButton pending={pending} label="Run Verification" disabled={!backupId} />
        </div>
      </form>
    </ModalShell>
  );
}

// ========== GENERATE COMPLIANCE REPORT MODAL ==========
function GenerateComplianceReportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [reportType, setReportType] = useState("backup_compliance");
  const [organizationId, setOrganizationId] = useState("");
  const [periodStart, setPeriodStart] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await generateComplianceReportAction({
        reportType: reportType as any,
        organizationId: organizationId || undefined,
        periodStart,
        periodEnd,
      });
      if (result.status === "success") {
        showToast("Report generation started.", "success");
        onSuccess();
        onClose();
      } else {
        setError(result.message || "Failed to generate report.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ModalShell title="Generate Compliance Report" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        <div className="space-y-1">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Report Type</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="backup_compliance">Backup Compliance</option>
            <option value="recovery_testing">Recovery Testing</option>
            <option value="dr_readiness">DR Readiness</option>
            <option value="audit">Audit</option>
            <option value="gdpr">GDPR</option>
            <option value="soc2">SOC 2</option>
            <option value="hipaa">HIPAA</option>
            <option value="pci">PCI</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Organization ID (optional)</label>
          <input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Period Start</label>
            <input value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} type="date" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Period End</label>
            <input value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} type="date" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted">Cancel</button>
          <SubmitButton pending={pending} label="Generate Report" />
        </div>
      </form>
    </ModalShell>
  );
}

// ========== PITR RESTORE MODAL ==========
function PitrRestoreModal({ pitrPointId, dashboard, onClose, onSuccess }: { pitrPointId: string; dashboard: BackupDashboard; onClose: () => void; onSuccess: () => void }) {
  const pitrPoint = dashboard.pitrPoints.find((p) => p.id === pitrPointId);
  const [scope, setScope] = useState("platform");
  const [stepUpEmail, setStepUpEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ts = pitrPoint ? pitrPoint.recoveryTimestamp.replace(/[^0-9]/g, "") : "";
  const expectedConfirm = `PITR:${ts}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmText !== expectedConfirm) {
      setError(`Type "${expectedConfirm}" to confirm.`);
      return;
    }
    if (!pitrPoint) return;
    setPending(true);
    setError(null);
    try {
      const completedBackup = dashboard.recentBackups.find((b) => b.status === "completed");
      if (!completedBackup) { setError("No completed backup found for PITR."); setPending(false); return; }
      const result = await initiateRecoveryAction({
        backupId: completedBackup.id,
        recoveryType: "full_platform",
        scope: scope as any,
        pitrPointId: pitrPoint.id,
        pitrTimestamp: pitrPoint.recoveryTimestamp,
        stepUpEmail,
      });
      if (result.status === "success") {
        showToast("PITR restore initiated.", "success");
        onSuccess();
        onClose();
      } else {
        setError(result.message || "Failed to initiate PITR restore.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate PITR restore.");
    } finally {
      setPending(false);
    }
  }

  if (!pitrPoint) return null;

  return (
    <ModalShell title="PITR Restore" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        <div className="rounded-lg border border-border bg-background p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Recovery Point</span><span className="font-bold">{new Date(pitrPoint.recoveryTimestamp).toLocaleString("en-IN")}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Resource</span><span className="font-bold">{formatAnalyticsLabel(pitrPoint.resourceType)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Granularity</span><span className="font-bold">{formatAnalyticsLabel(pitrPoint.granularity)}</span></div>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="flex items-center gap-2 text-amber-800"><Info className="size-4" /><p className="font-black">Warning</p></div>
          <p className="mt-1 text-xs text-amber-700">Restoring to this point will roll back all data to {new Date(pitrPoint.recoveryTimestamp).toLocaleString("en-IN")}. Current data changes after this point will be lost.</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Scope</label>
          <div className="flex gap-2">
            {["platform", "tenant", "branch"].map((s) => (
              <button key={s} type="button" onClick={() => setScope(s)}
                className={`rounded-md border px-4 py-2 text-xs font-black transition-all ${scope === s ? "border-accent bg-accent/5" : "border-border bg-background"}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">MFA Step-Up Email</label>
          <input value={stepUpEmail} onChange={(e) => setStepUpEmail(e.target.value)} type="email" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" required />
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <p className="text-xs font-black text-destructive">Type <span className="font-mono">{expectedConfirm}</span> to confirm</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={expectedConfirm} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono" />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted">Cancel</button>
          <button type="submit" disabled={pending || confirmText !== expectedConfirm || !stepUpEmail} className="inline-flex items-center gap-2 rounded-md bg-destructive text-destructive-foreground px-4 py-2 text-sm font-black hover:-translate-y-0.5 transition-transform shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Restore to This Point
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ========== APPROVAL ACTION MODAL ==========
function ApprovalActionModal({ approvalId, action, onClose, onSuccess }: { approvalId: string; action: "approve" | "reject" | "escalate"; onClose: () => void; onSuccess: () => void }) {
  const [reviewNote, setReviewNote] = useState("");
  const [stepUpEmail, setStepUpEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionColors = { approve: "border-green-200 bg-green-50", reject: "border-red-200 bg-red-50", escalate: "border-amber-200 bg-amber-50" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await approveRecoveryAction({ recoveryId: approvalId, decision: action, reviewNote: reviewNote || undefined, stepUpEmail });
      if (result.status === "success") {
        showToast(`Recovery ${action}d.`, "success");
        onSuccess();
        onClose();
      } else {
        setError(result.message || "Action failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ModalShell title={`${action.charAt(0).toUpperCase() + action.slice(1)} Recovery`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        <div className={`rounded-md border ${actionColors[action]} p-3`}>
          <p className="text-sm font-black capitalize">{action} this recovery request</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Review Note (optional)</label>
          <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} maxLength={500} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">MFA Step-Up Email</label>
          <input value={stepUpEmail} onChange={(e) => setStepUpEmail(e.target.value)} type="email" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" required />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted">Cancel</button>
          <SubmitButton pending={pending} label={action.charAt(0).toUpperCase() + action.slice(1)} disabled={!stepUpEmail} />
        </div>
      </form>
    </ModalShell>
  );
}
