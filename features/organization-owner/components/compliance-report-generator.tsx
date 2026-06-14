"use client";

import { useCallback, useState } from "react";
import { Download, FileText, Loader2, ShieldCheck } from "lucide-react";
import { showToast } from "@/components/ui/toast";

type ReportType = "gdpr_data_export" | "soc2_audit_log" | "data_deletion_log" | "consent_records" | "all_members_export";

type ComplianceReportGeneratorProps = {
  organizationId: string;
  organizationName: string;
};

const reportConfig: Record<ReportType, { label: string; description: string; icon: string }> = {
  gdpr_data_export: { label: "GDPR Data Export", description: "All personal data for a specific member", icon: "🛡️" },
  soc2_audit_log: { label: "SOC 2 Audit Log Export", description: "All activity events for compliance audit", icon: "📋" },
  data_deletion_log: { label: "Data Deletion Log", description: "Records of deleted member data", icon: "🗑️" },
  consent_records: { label: "Consent Records", description: "Member communication consent history", icon: "📝" },
  all_members_export: { label: "All Members CSV", description: "Complete member roster with contact info", icon: "👥" },
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function ComplianceReportGenerator({ organizationId, organizationName }: ComplianceReportGeneratorProps) {
  const [reportType, setReportType] = useState<ReportType>("soc2_audit_log");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [completed, setCompleted] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setCompleted(null);
    try {
      // In production, this would call a server action
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const reportName = `${reportType}-${new Date().toISOString().slice(0, 10)}`;
      setCompleted(reportName);

      // Generate CSV
      const headers = ["Report Type", "Organization", "Generated At", "Date Range"];
      const rows = [[reportType, organizationName, new Date().toISOString(), `${dateFrom || "All"} to ${dateTo || "All"}`]];
      const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${reportName}.csv`; a.click();
      URL.revokeObjectURL(url);
      showToast("Report generated and downloaded", "success");
    } catch {
      showToast("Failed to generate report", "error");
    } finally {
      setGenerating(false);
    }
  }, [reportType, dateFrom, dateTo, organizationId, organizationName]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-green-100 p-2"><ShieldCheck className="size-5 text-green-700" /></div>
        <div>
          <h3 className="text-xl font-black">Compliance Reports</h3>
          <p className="text-sm text-muted-foreground">Generate audit-ready reports for GDPR, SOC 2, and internal compliance</p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-bold">Report Type</label>
          <select className={selectClass} value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
            {Object.entries(reportConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{reportConfig[reportType].description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-bold">Date From</label>
            <input className={selectClass} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">Date To</label>
            <input className={selectClass} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {completed ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800" role="alert">
          Report generated: <strong>{completed}.csv</strong>
        </div>
      ) : null}

      <div className="flex gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-50"
          disabled={generating}
          onClick={handleGenerate}
          type="button"
        >
          {generating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {generating ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {/* Available reports info */}
      <div className="rounded-lg border border-border bg-surface-muted p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Available Reports</p>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(reportConfig).map(([key, cfg]) => (
            <div key={key} className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
              <span className="text-lg">{cfg.icon}</span>
              <div>
                <p className="text-sm font-bold">{cfg.label}</p>
                <p className="text-xs text-muted-foreground">{cfg.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
