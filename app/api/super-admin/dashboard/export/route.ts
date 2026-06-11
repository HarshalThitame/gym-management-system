import { formatCurrency } from "@/features/enterprise/lib/business-rules";
import { getSuperAdminDashboardExportSummary, resolveDashboardDateRange } from "@/features/super-admin/services/dashboard-service";
import { requireApiRole } from "@/lib/auth/api-guards";

export async function GET(request: Request) {
  const auth = await requireApiRole(["super_admin"]);

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const dateRangeInput: { range?: string; from?: string; to?: string } = {};
  const range = url.searchParams.get("range");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (range) {
    dateRangeInput.range = range;
  }
  if (from) {
    dateRangeInput.from = from;
  }
  if (to) {
    dateRangeInput.to = to;
  }

  const dateRange = resolveDashboardDateRange(dateRangeInput);
  const summary = await getSuperAdminDashboardExportSummary(dateRange);
  const rows: Array<[string, string]> = [
    ["Date range", dateRange.label],
    ["Organizations", String(summary.organizations)],
    ["Gyms", String(summary.gyms)],
    ["Branches", String(summary.branches)],
    ["Assigned packages", String(summary.assignedPackages)],
    ["Unassigned packages", String(summary.unassignedPackages)],
    ["Net revenue", formatCurrency(summary.finance.netRevenue)],
    ["Gross revenue", formatCurrency(summary.finance.grossRevenue)],
    ["Refunds", formatCurrency(summary.finance.refundAmount)],
    ["Outstanding amount", formatCurrency(summary.finance.outstandingAmount)],
    ["Failed payments", String(summary.finance.failedPayments)],
    ["Reconciliation issues", String(summary.finance.reconciliationIssues)],
    ["Uptime", `${summary.slo.uptimePercent}%`],
    ["Error rate", `${summary.slo.errorRatePercent}%`],
    ["API P95", summary.slo.apiP95Ms === null ? "No data" : `${summary.slo.apiP95Ms}ms`],
    ["Database P95", summary.slo.databaseP95Ms === null ? "No data" : `${summary.slo.databaseP95Ms}ms`],
    ["Failed jobs", String(summary.slo.failedJobs)],
    ["Webhook failures", String(summary.slo.webhookFailures)],
    ["Privileged users", String(summary.roleRisk.privilegedUsers)],
    ["Role changes", String(summary.roleRisk.recentRoleChanges)],
    ["Failed login signals", String(summary.roleRisk.failedLoginSignals)]
  ];

  if (format === "pdf") {
    const pdfBytes = await buildPdf(rows);
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Disposition": `attachment; filename=\"super-admin-dashboard-${dateRange.key}.pdf\"`,
        "Content-Type": "application/pdf"
      }
    });
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Disposition": `attachment; filename=\"super-admin-dashboard-${dateRange.key}.csv\"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}

async function buildPdf(rows: Array<[string, string]>) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  let y = 742;

  page.drawText("Super Admin Executive Dashboard", {
    x: 48,
    y,
    size: 18,
    font: titleFont,
    color: rgb(0.08, 0.08, 0.1)
  });
  y -= 34;

  for (const [label, value] of rows) {
    if (y < 60) {
      break;
    }

    page.drawText(pdfSafeText(label), {
      x: 48,
      y,
      size: 10,
      font: titleFont,
      color: rgb(0.16, 0.16, 0.18)
    });
    page.drawText(pdfSafeText(value), {
      x: 270,
      y,
      size: 10,
      font: bodyFont,
      color: rgb(0.28, 0.28, 0.31)
    });
    y -= 22;
  }

  return await pdf.save();
}

function toCsv(rows: Array<[string, string]>) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function csvEscape(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function pdfSafeText(value: string) {
  return value
    .replaceAll("₹", "INR ")
    .replace(/[^\x20-\x7E]/g, " ");
}
