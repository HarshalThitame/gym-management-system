import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, FileText, RefreshCw, CheckCircle, XCircle, AlertTriangle, ChevronDown } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { Badge } from "@/components/ui/badge";
import { getComplianceStatus, listComplianceReports } from "@/features/security/services/security-compliance-service";
import { runAllComplianceChecks } from "@/features/security/services/compliance-checker-service";
import { rerunComplianceChecks } from "./actions";

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const color = score > 90 ? "#16A34A" : score > 70 ? "#D97706" : "#DC2626";
  const innerSize = size - 8;
  return (
    <div
      className="grid place-items-center rounded-full shrink-0"
      style={{ width: size, height: size, background: `conic-gradient(${color} ${score}%, #E4E7DD ${score}%)` }}
    >
      <div
        className="grid place-items-center rounded-full bg-card"
        style={{ width: innerSize, height: innerSize }}
      >
        <span className="text-sm font-black">{score}%</span>
      </div>
    </div>
  );
}

async function ComplianceContent() {
  await requireRole(["super_admin"], "/super-admin");
  const [status, reports, frameworks] = await Promise.all([
    getComplianceStatus(),
    listComplianceReports(),
    runAllComplianceChecks(),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/super-admin/security" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.06em]">
        <ChevronLeft className="size-3.5" /> Back to Security
      </Link>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Governance</p>
          <h2 className="mt-2 text-2xl font-black md:text-3xl">Compliance & Governance</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground max-w-2xl">Real-time compliance monitoring across security frameworks. Automated checks validate RLS coverage, RBAC roles, audit logs, storage policies, and encryption.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <form action={rerunComplianceChecks}>
            <button type="submit" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 transition-colors uppercase tracking-[0.06em]">
              <RefreshCw className="size-3.5" /> Run All Checks
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {frameworks.map((fw, i) => {
          const statusLabel = fw.overallScore > 90 ? "Compliant" : fw.overallScore > 70 ? "At Risk" : "Non-Compliant";
          const statusVariant = fw.overallScore > 90 ? "success" : fw.overallScore > 70 ? "warning" : "error" as const;
          return (
            <details key={fw.framework} className="group reveal-up rounded-xl border border-border bg-card shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-5" style={{"--reveal-delay": `${i * 0.05}s`} as React.CSSProperties}>
              <summary className="list-none cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ScoreRing score={fw.overallScore} />
                    <div>
                      <div className="text-base font-black">{fw.displayName}</div>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                    </div>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                {fw.checks.map((check, ci) => {
                  const icon = check.status === "pass"
                    ? <CheckCircle className="size-4 shrink-0 text-green-600" />
                    : check.status === "fail"
                    ? <XCircle className="size-4 shrink-0 text-red-600" />
                    : <AlertTriangle className="size-4 shrink-0 text-amber-600" />;
                  return (
                    <div key={ci} className="flex items-start gap-3 rounded-md bg-muted/20 px-3 py-2.5 text-sm">
                      {icon}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs">{check.check}</span>
                          <span className={`text-[10px] font-bold uppercase shrink-0 ${
                            check.status === "pass" ? "text-green-600" : check.status === "fail" ? "text-red-600" : "text-amber-600"
                          }`}>{check.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-5">{check.details}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Compliance Reports ({reports.length})</p>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 transition-colors uppercase tracking-[0.06em]">
              <FileText className="size-3.5" /> Generate Report
            </button>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No reports generated</p>
                <p className="text-xs text-muted-foreground mt-1">Generate your first compliance report</p>
              </div>
            ) : reports.map((r: Record<string, unknown>, idx: number) => {
              const rr = r as { id: string; title: string; report_type: string; period_start: string; period_end: string; status: string; file_url: string | null };
              return (
                <div key={rr.id ?? idx} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div>
                    <p className="text-sm font-bold">{rr.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rr.report_type?.toUpperCase()} · {rr.period_start} to {rr.period_end}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                      rr.status === "ready" ? "border-green-200 bg-green-50 text-green-700" :
                      rr.status === "generating" ? "border-amber-200 bg-amber-50 text-amber-800" :
                      "border-red-200 bg-red-50 text-red-700"
                    }`}>{rr.status}</span>
                    {rr.file_url && <a href={rr.file_url} className="text-xs font-bold text-primary hover:underline">Download</a>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Audit Overview</p>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-md bg-muted/20 px-4 py-3">
              <span className="text-sm text-muted-foreground">Audit Logs (90d)</span>
              <span className="text-xl font-black">{status.auditLogs90d.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/20 px-4 py-3">
              <span className="text-sm text-muted-foreground">GDPR Requests</span>
              <span className="text-xl font-black">{status.gdprRequests}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/20 px-4 py-3">
              <span className="text-sm text-muted-foreground">SOC 2 Reports</span>
              <span className="text-xl font-black">{status.soc2Reports}</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Frameworks Checked</p>
            <p className="mt-1 text-xs text-muted-foreground">Automated compliance checks are running across all frameworks.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {frameworks.map((fw) => {
                const dotColor = fw.overallScore > 90 ? "bg-green-500" : fw.overallScore > 70 ? "bg-amber-500" : "bg-red-500";
                return (
                  <span key={fw.framework} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${dotColor}`} />
                    {fw.displayName} ({fw.overallScore}%)
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompliancePage() {
  return <Suspense fallback={<div className="space-y-6"><div className="h-5 w-32 bg-muted rounded animate-pulse" /><div className="h-8 w-48 bg-muted rounded-lg animate-pulse" /><div className="grid grid-cols-4 gap-4"><div className="h-32 bg-muted rounded-xl animate-pulse" /><div className="h-32 bg-muted rounded-xl animate-pulse" /><div className="h-32 bg-muted rounded-xl animate-pulse" /><div className="h-32 bg-muted rounded-xl animate-pulse" /></div></div>}><ComplianceContent /></Suspense>;
}
