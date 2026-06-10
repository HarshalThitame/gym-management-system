import type { AnalyticsReportKey, ForecastPoint, KpiCard } from "@/types/analytics";
import type { Json } from "@/types/database";

export function percent(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.round((part / total) * 10000) / 100;
}

export function percentageChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

export function kpiStatus(change: number, direction: "higher_is_better" | "lower_is_better" = "higher_is_better"): KpiCard["status"] {
  if (direction === "lower_is_better") {
    if (change <= -5) {
      return "good";
    }
    if (change >= 8) {
      return "risk";
    }
    return "watch";
  }

  if (change >= 5) {
    return "good";
  }
  if (change <= -8) {
    return "risk";
  }
  return "watch";
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: value >= 100 ? 0 : 1
  }).format(value);
}

export function formatCurrency(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function estimateLifetimeValue(monthRevenue: number, activeMembers: number, retentionRate: number) {
  if (activeMembers <= 0) {
    return 0;
  }
  const monthlyArpu = monthRevenue / activeMembers;
  const expectedMonths = retentionRate >= 100 ? 24 : Math.max(1, 1 / Math.max((100 - retentionRate) / 100, 0.04));
  return Math.round(monthlyArpu * Math.min(expectedMonths, 36));
}

export function movingAverageForecast(values: number[], horizonDays: number) {
  if (values.length === 0) {
    return 0;
  }
  const window = values.slice(-Math.min(values.length, 30));
  const dailyAverage = window.reduce((total, value) => total + value, 0) / window.length;
  return Math.round(dailyAverage * horizonDays);
}

export function buildForecastPoint(input: { metricKey: string; label: string; values: number[]; horizonDays: number }): ForecastPoint {
  const forecastValue = movingAverageForecast(input.values, input.horizonDays);
  const confidence = input.values.length >= 90 ? "baseline" : input.values.length >= 30 ? "medium" : "low";

  return {
    metricKey: input.metricKey,
    label: input.label,
    forecastValue,
    confidence,
    horizonDays: input.horizonDays
  };
}

export function reportTitle(reportKey: AnalyticsReportKey) {
  const titles: Record<AnalyticsReportKey, string> = {
    executive_kpi_snapshot: "Executive KPI Snapshot",
    revenue_sources: "Revenue Source Report",
    membership_retention: "Membership Retention Report",
    attendance_engagement: "Attendance Engagement Report",
    trainer_scorecard: "Trainer Performance Scorecard",
    class_utilization: "Class Utilization Report",
    fitness_outcomes: "Fitness Outcomes Report",
    sales_funnel: "Sales Funnel Report"
  };
  return titles[reportKey];
}

export function formatAnalyticsLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function parseJsonObject(value: string): { ok: true; value: Json } | { ok: false; message: string } {
  if (!value.trim()) {
    return { ok: true, value: {} };
  }

  try {
    const parsed = JSON.parse(value) as Json;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, message: "Enter a JSON object." };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, message: "Enter valid JSON." };
  }
}

export function parseJsonArray(value: string): { ok: true; value: Json } | { ok: false; message: string } {
  if (!value.trim()) {
    return { ok: true, value: [] };
  }

  try {
    const parsed = JSON.parse(value) as Json;
    if (!Array.isArray(parsed)) {
      return { ok: false, message: "Enter a JSON array." };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, message: "Enter valid JSON." };
  }
}

export function toCsv(headers: string[], rows: Array<Record<string, string | number | null>>) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(String(row[header] ?? ""))).join(","))
  ].join("\n");
}

export function toExcelHtml(input: { title: string; generatedAt: string; headers: string[]; rows: Array<Record<string, string | number | null>> }) {
  const rows = input.rows.length > 0 ? input.rows : [Object.fromEntries(input.headers.map((header, index) => [header, index === 0 ? "No records found" : ""]))];
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\" />",
    "<style>body{font-family:Arial,sans-serif;color:#111315}h1{font-size:20px;margin:0 0 6px}p{font-size:12px;color:#5f646b}table{border-collapse:collapse;width:100%}th{background:#eef1ea;font-weight:700}th,td{border:1px solid #d8ddd2;padding:8px;text-align:left;font-size:12px;vertical-align:top}</style>",
    "</head><body>",
    `<h1>${escapeHtml(input.title)}</h1><p>Generated at ${escapeHtml(input.generatedAt)}</p>`,
    `<table><thead><tr>${input.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`,
    `<tbody>${rows.map((row) => `<tr>${input.headers.map((header) => `<td>${escapeHtml(String(row[header] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
    "</body></html>"
  ].join("");
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}
