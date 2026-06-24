import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency } from "@/features/enterprise/lib/business-rules";

export function calculateNextScheduledAt(
  frequency: "daily" | "weekly" | "monthly",
  dayOfWeek?: number,
  dayOfMonth?: number
): string {
  const now = new Date();
  const next = new Date(now);

  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
  } else if (frequency === "weekly") {
    const targetDay = dayOfWeek ?? 1;
    const currentDay = next.getDay() || 7;
    const daysUntil = ((targetDay - currentDay + 7) % 7) || 7;
    next.setDate(next.getDate() + daysUntil);
    next.setHours(9, 0, 0, 0);
  } else if (frequency === "monthly") {
    const targetDate = Math.min(dayOfMonth ?? 1, 28);
    if (next.getDate() >= targetDate) {
      next.setMonth(next.getMonth() + 1);
    }
    next.setDate(targetDate);
    next.setHours(9, 0, 0, 0);
  }

  return next.toISOString();
}

// ─── PDF generation (shared by server action and cron route) ────────────────

export type ReportType =
  | "revenue_summary"
  | "member_report"
  | "attendance_report"
  | "class_report"
  | "trainer_performance"
  | "dashboard_summary";

export async function generateReportPdfInternal(
  supabase: SupabaseClient,
  organizationId: string,
  reportType: ReportType,
  dateFrom?: string,
  dateTo?: string
): Promise<{ pdfBuffer: Uint8Array; fileName: string }> {
  const now = new Date();
  const from = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = dateTo ? new Date(dateTo) : now;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const dark = rgb(0.067, 0.071, 0.078);
  const muted = rgb(0.37, 0.39, 0.43);

  let y = 780;

  const reportLabels: Record<string, string> = {
    revenue_summary: "Revenue Summary",
    member_report: "Member Report",
    attendance_report: "Attendance Report",
    class_report: "Class Report",
    trainer_performance: "Trainer Performance",
    dashboard_summary: "Dashboard Summary",
  };

  page.drawText(reportLabels[reportType] ?? "Report", { x: 48, y, size: 20, font: bold, color: dark });
  page.drawText(`${from.toISOString().slice(0, 10)} \u2013 ${to.toISOString().slice(0, 10)}`, { x: 48, y: y - 22, size: 10, font: regular, color: muted });
  y -= 70;

  if (reportType === "revenue_summary") {
    const { data: gyms } = await supabase.from("gyms").select("id").eq("organization_id", organizationId);
    const gymIds = gyms?.map((g: { id: string }) => g.id) ?? [];

    const { data: payments } = await supabase
      .from("payments")
      .select("amount, status, created_at")
      .in("gym_id", gymIds)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString());

    const paymentRows = (payments ?? []) as Array<{ amount: unknown; status: string; created_at: string }>;
    const totalRevenue = paymentRows.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const paid = paymentRows.filter((p) => p.status === "paid");
    const failed = paymentRows.filter((p) => p.status === "failed");

    page.drawText("Revenue", { x: 48, y, size: 16, font: bold, color: dark });
    y -= 28;
    drawLine(page, regular, dark, "Total Revenue", formatCurrency(totalRevenue), 48, y);
    y -= 22;
    drawLine(page, regular, dark, "Successful Payments", String(paid.length), 48, y);
    y -= 22;
    drawLine(page, regular, dark, "Failed Payments", String(failed.length), 48, y);
    y -= 22;
    drawLine(page, regular, dark, "Success Rate", paid.length + failed.length > 0 ? `${Math.round((paid.length / (paid.length + failed.length)) * 100)}%` : "N/A", 48, y);

    if (paymentRows.length > 0) {
      y -= 40;
      drawTableHeader(page, bold, ["Date", "Amount", "Status"], 48, y);
      y -= 22;
      for (const p of paymentRows.slice(0, 20)) {
        drawTableRow(page, regular, [
          p.created_at?.slice(0, 10) ?? "",
          formatCurrency(Number(p.amount ?? 0)),
          p.status ?? "",
        ], 48, y);
        y -= 20;
        if (y < 80) break;
      }
    }
  } else if (reportType === "member_report") {
    const { data: gyms } = await supabase.from("gyms").select("id").eq("organization_id", organizationId);
    const gymIds = gyms?.map((g: { id: string }) => g.id) ?? [];

    const { data: members } = await supabase
      .from("members")
      .select("full_name, status, phone, joined_at")
      .in("gym_id", gymIds)
      .order("joined_at", { ascending: false })
      .limit(100);

    const memberRows = (members ?? []) as Array<{ full_name: string | null; status: string; phone: string | null; joined_at: string | null }>;
    const activeCount = memberRows.filter((m) => m.status === "active").length;

    page.drawText("Member Report", { x: 48, y, size: 16, font: bold, color: dark });
    y -= 28;
    drawLine(page, regular, dark, "Total Members", String(memberRows.length), 48, y);
    y -= 22;
    drawLine(page, regular, dark, "Active Members", String(activeCount), 48, y);
    y -= 40;

    if (memberRows.length > 0) {
      drawTableHeader(page, bold, ["Name", "Status", "Phone", "Joined"], 48, y);
      y -= 22;
      for (const m of memberRows.slice(0, 30)) {
        drawTableRow(page, regular, [
          (m.full_name ?? "").slice(0, 20),
          m.status ?? "",
          (m.phone ?? "").slice(0, 15),
          m.joined_at?.slice(0, 10) ?? "",
        ], 48, y);
        y -= 20;
        if (y < 80) break;
      }
    }
  } else {
    page.drawText("Report Summary", { x: 48, y, size: 16, font: bold, color: dark });
    y -= 28;
    page.drawText("This report type content will be expanded in a future update.", { x: 48, y, size: 10, font: regular, color: muted });
    y -= 22;
    page.drawText("Period: " + from.toISOString().slice(0, 10) + " to " + to.toISOString().slice(0, 10), { x: 48, y, size: 10, font: regular, color: muted });
  }

  const pdfBytes = await pdf.save();
  const sanitizedType = reportType.replace(/_/g, "-");
  const fileName = `${sanitizedType}-${from.toISOString().slice(0, 10)}.pdf`;

  return { pdfBuffer: pdfBytes, fileName };
}

// ─── Helper drawing functions ───────────────────────────────────────────────

function drawLine(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color: ReturnType<typeof rgb>,
  label: string,
  value: string,
  x: number,
  y: number
) {
  page.drawText(label, { x, y, size: 10, font, color });
  page.drawText(value, { x: x + 300, y, size: 10, font, color });
}

function drawTableHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  boldFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  headers: string[],
  x: number,
  y: number
) {
  const colWidths = [140, 100, 100, 120];
  let cx = x;
  headers.forEach((h, i) => {
    page.drawText(h, { x: cx, y, size: 9, font: boldFont, color: rgb(0.067, 0.071, 0.078) });
    cx += colWidths[i] ?? 100;
  });
}

function drawTableRow(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  values: string[],
  x: number,
  y: number
) {
  const colWidths = [140, 100, 100, 120];
  let cx = x;
  values.forEach((v, i) => {
    page.drawText(v.slice(0, 25), { x: cx, y, size: 9, font, color: rgb(0.37, 0.39, 0.43) });
    cx += colWidths[i] ?? 100;
  });
}
