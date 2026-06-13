/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  const dataset = searchParams.get("dataset") ?? "executive";
  const from = searchParams.get("from") ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = searchParams.get("to") ?? new Date().toISOString().slice(0, 10);

  try {
    let data: unknown[] = [];
    let headers: string[] = [];
    let title = "Analytics Export";

    if (dataset === "executive" || dataset === "revenue") {
      const { data: raw } = await supabase.from("analytics_revenue_daily")
        .select("*").gte("metric_date", from).lte("metric_date", to).order("metric_date", { ascending: true }).limit(5000);
      if (raw) data = raw as unknown[];
      headers = ["metric_date", "gross_revenue", "membership_revenue", "renewal_revenue", "pt_revenue", "class_revenue", "paid_payments", "paying_members"];
      title = "Revenue Analytics Export";
    } else if (dataset === "membership") {
      const { data: raw } = await supabase.from("analytics_membership_daily")
        .select("*").gte("metric_date", from).lte("metric_date", to).order("metric_date", { ascending: true }).limit(5000);
      if (raw) data = raw as unknown[];
      headers = ["metric_date", "memberships_created", "active_memberships", "expired_memberships", "renewals"];
      title = "Membership Analytics Export";
    } else if (dataset === "churn") {
      const { data: raw } = await (supabase.rpc as any)("predict_churn_risk", { p_tenant_id: null });
      if (raw) data = raw as unknown[];
      headers = ["member_id", "risk_score", "risk_category", "predicted_days_to_churn", "top_signals"];
      title = "Churn Prediction Export";
    } else if (dataset === "forecast") {
      const { data: raw } = await (supabase.rpc as any)("forecast_metric", {
        p_metric_query: "select sum(gross_revenue) as value from analytics_revenue_daily where metric_date >= current_date - 90",
        p_horizon_days: 90, p_seasonality_days: 7
      });
      if (raw) data = raw as unknown[];
      headers = ["forecast_date", "forecast_value", "confidence"];
      title = "Revenue Forecast Export";
    }

    if (data.length === 0) return new Response("No data for selected criteria", { status: 200 });

    if (format === "csv") {
      const csvRows = [headers.join(","), ...data.map((row) => headers.map((h) => {
        const v = (row as Record<string, unknown>)[h];
        const s = String(v ?? "");
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","))];
      return new Response(csvRows.join("\n"), {
        headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${title.replace(/\s+/g, "_")}_${from}_${to}.csv"` }
      });
    }

    if (format === "json") {
      return NextResponse.json({ title, generated_at: new Date().toISOString(), from, to, row_count: data.length, data });
    }

    if (format === "excel") {
      const htmlRows = data.map((row) => `<tr>${headers.map((h) => `<td>${String((row as Record<string, unknown>)[h] ?? "")}</td>`).join("")}</tr>`).join("");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Arial;color:#111}table{border-collapse:collapse;width:100%}th{background:#1a1a2e;color:#fff;padding:10px;text-align:left;font-size:12px}td{border:1px solid #ddd;padding:8px;font-size:11px}tr:nth-child(even){background:#f8f9fa}h1{font-size:18px;margin:20px 0 5px}p{font-size:12px;color:#666;margin:0 0 20px}</style></head><body>
<h1>${title}</h1><p>Generated: ${new Date().toISOString()} | Period: ${from} to ${to} | Rows: ${data.length}</p>
<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${htmlRows}</tbody></table></body></html>`;
      return new Response(html, {
        headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${title.replace(/\s+/g, "_")}_${from}_${to}.xls"` }
      });
    }

    if (format === "pdf") {
      const htmlRows = data.slice(0, 50).map((row) => `<tr>${headers.map((h) => `<td style="border:1px solid #ddd;padding:6px;font-size:10px">${String((row as Record<string, unknown>)[h] ?? "")}</td>`).join("")}</tr>`).join("");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Arial;color:#111;padding:20px}table{border-collapse:collapse;width:100%}th{background:#1a1a2e;color:#fff;padding:8px;text-align:left;font-size:11px}td{border:1px solid #ddd;padding:6px;font-size:10px}h1{font-size:20px}@media print{@page{size:A4 landscape;margin:15mm}}</style></head><body>
<h1>${title}</h1><p>Generated: ${new Date().toISOString()} | Period: ${from} to ${to}</p>
<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${htmlRows}</tbody></table>
<p style="margin-top:20px;font-size:10px;color:#999">Confidential - For authorized personnel only</p></body></html>`;
      return new Response(html, {
        headers: { "Content-Type": "text/html", "Content-Disposition": `inline; filename="${title.replace(/\s+/g, "_")}_${from}_${to}.html"` }
      });
    }

    if (format === "powerpoint") {
      const slideRows = data.slice(0, 20).map((row) => `<tr>${headers.map((h) => `<td style="border:1px solid #666;padding:4px;font-size:10px">${String((row as Record<string, unknown>)[h] ?? "—")}</td>`).join("")}</tr>`).join("");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Arial;background:#fff;color:#111;padding:0}.slide{width:10in;height:7.5in;page-break-after:always;padding:0.5in;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center}.slide h1{font-size:28px;margin-bottom:8px}.slide p{font-size:14px;color:#666;margin-bottom:20px}.slide table{width:100%;border-collapse:collapse;font-size:11px}.slide th{background:#1a1a2e;color:#fff;padding:6px;text-align:left}.slide td{border:1px solid #ccc;padding:4px}.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}.kpi{background:#f0f4ff;padding:12px;border-radius:8px;text-align:center}.kpi .value{font-size:24px;font-weight:bold;color:#1a1a2e}.kpi .label{font-size:10px;color:#666;text-transform:uppercase}</style></head><body>
<div class="slide"><h1>${title}</h1><p>Generated: ${new Date().toISOString()} | Period: ${from} to ${to}</p>
<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${slideRows}</tbody></table>
<p style="margin-top:12px;font-size:9px;color:#999">Confidential</p></div></body></html>`;
      return new Response(html, {
        headers: { "Content-Type": "text/html", "Content-Disposition": `attachment; filename="${title.replace(/\s+/g, "_")}.html"` }
      });
    }

    return NextResponse.json({ title, generated_at: new Date().toISOString(), from, to, row_count: data.length, data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
