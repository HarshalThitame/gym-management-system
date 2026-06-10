import { describe, expect, it } from "vitest";
import { analyticsRowsToCsv, analyticsRowsToExcel, analyticsRowsToPdf } from "@/features/analytics/lib/report-export";
import {
  buildForecastPoint,
  estimateLifetimeValue,
  formatAnalyticsLabel,
  kpiStatus,
  movingAverageForecast,
  parseJsonArray,
  parseJsonObject,
  percent,
  percentageChange,
  reportTitle,
  toCsv
} from "@/features/analytics/lib/business-rules";
import type { AnalyticsReportPayload } from "@/types/analytics";

describe("analytics business rules", () => {
  it("calculates percentages, changes, and KPI status", () => {
    expect(percent(25, 40)).toBe(62.5);
    expect(percent(1, 0)).toBe(0);
    expect(percentageChange(120, 100)).toBe(20);
    expect(percentageChange(0, 0)).toBe(0);
    expect(kpiStatus(12)).toBe("good");
    expect(kpiStatus(-10)).toBe("risk");
    expect(kpiStatus(-8, "lower_is_better")).toBe("good");
  });

  it("estimates lifetime value and moving-average forecasts", () => {
    expect(estimateLifetimeValue(100000, 50, 80)).toBe(10000);
    expect(estimateLifetimeValue(100000, 0, 80)).toBe(0);
    expect(movingAverageForecast([10, 20, 30], 7)).toBe(140);
    expect(buildForecastPoint({ metricKey: "revenue", label: "Revenue", values: Array.from({ length: 30 }, () => 100), horizonDays: 30 })).toEqual({
      metricKey: "revenue",
      label: "Revenue",
      forecastValue: 3000,
      confidence: "medium",
      horizonDays: 30
    });
  });

  it("normalizes labels, titles, and JSON filters", () => {
    expect(formatAnalyticsLabel("trainer_underutilization")).toBe("Trainer Underutilization");
    expect(reportTitle("trainer_scorecard")).toBe("Trainer Performance Scorecard");
    expect(parseJsonObject("{\"range\":\"last_30_days\"}")).toEqual({ ok: true, value: { range: "last_30_days" } });
    expect(parseJsonObject("[1,2]")).toEqual({ ok: false, message: "Enter a JSON object." });
    expect(parseJsonArray("[\"revenue\",\"members\"]")).toEqual({ ok: true, value: ["revenue", "members"] });
    expect(parseJsonArray("{bad")).toEqual({ ok: false, message: "Enter valid JSON." });
  });

  it("exports analytics reports as CSV, Excel, and PDF", async () => {
    expect(toCsv(["name", "notes"], [{ name: "Revenue", notes: "A, B" }])).toContain("\"A, B\"");
    expect(analyticsRowsToCsv(report())).toContain("Monthly Revenue");
    expect(analyticsRowsToExcel(report())).toContain("Executive KPI Snapshot");
    expect(new TextDecoder().decode((await analyticsRowsToPdf(report())).slice(0, 4))).toBe("%PDF");
  });
});

function report(): AnalyticsReportPayload {
  return {
    key: "executive_kpi_snapshot",
    category: "operations",
    title: "Executive KPI Snapshot",
    generatedAt: "2026-06-10T00:00:00.000Z",
    headers: ["label", "value", "status"],
    rows: [
      { label: "Monthly Revenue", value: 250000, status: "good" },
      { label: "Active Members", value: 340, status: "watch" }
    ]
  };
}
