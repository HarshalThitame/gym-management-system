import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, Shield, FileText, Info } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getComplianceStatus, listComplianceReports } from "@/features/security/services/security-compliance-service";

async function ComplianceContent() {
  await requireRole(["super_admin"], "/super-admin");
  const [status, reports] = await Promise.all([getComplianceStatus(), listComplianceReports()]);

  return (
    <div className="space-y-6">
      <Link href="/super-admin/security" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.06em]">
        <ChevronLeft className="size-3.5" /> Back to Security
      </Link>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Governance</p>
          <h2 className="mt-2 text-2xl font-black md:text-3xl">Compliance & Governance</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground max-w-2xl">Compliance status monitoring, report generation, and reference frameworks. Automated compliance checks are not yet configured for all frameworks.</p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">Compliance Framework Monitoring Not Fully Configured</p>
            <p className="mt-1 text-amber-700">The frameworks listed below are reference labels only. Automated compliance checks (RLS coverage, RBAC role coverage, audit log coverage, storage policies) are partially implemented. Compliance scores will appear once end-to-end automated checks are configured.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { name: "GDPR", desc: `${status.gdprRequests} requests this year`, icon: Shield },
          { name: "SOC 2", desc: `${status.soc2Reports} reports generated`, icon: Shield },
          { name: "ISO 27001", desc: "Reference framework", icon: Shield },
          { name: "HIPAA", desc: "Reference framework", icon: Shield },
        ].map((fw) => (
          <div key={fw.name} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <fw.icon className="size-5 text-muted-foreground" />
              <p className="text-lg font-black">{fw.name}</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{fw.desc}</p>
            <Badge className="mt-2">Reference framework</Badge>
          </div>
        ))}
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
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Reference Frameworks</p>
            <p className="mt-1 text-xs text-muted-foreground">The following standards are shown as reference labels only. Automated compliance checks are not yet configured for these frameworks.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["GDPR", "SOC 2", "ISO 27001", "HIPAA", "PCI DSS"].map((s) => (
                <span key={s} className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";

export default function CompliancePage() {
  return <Suspense fallback={<div className="space-y-6"><div className="h-5 w-32 bg-muted rounded animate-pulse" /><div className="h-8 w-48 bg-muted rounded-lg animate-pulse" /><div className="grid grid-cols-4 gap-4"><div className="h-24 bg-muted rounded-xl animate-pulse" /><div className="h-24 bg-muted rounded-xl animate-pulse" /><div className="h-24 bg-muted rounded-xl animate-pulse" /><div className="h-24 bg-muted rounded-xl animate-pulse" /></div></div>}><ComplianceContent /></Suspense>;
}
