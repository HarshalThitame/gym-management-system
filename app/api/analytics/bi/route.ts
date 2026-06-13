/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "json";
  const dataset = searchParams.get("dataset") ?? "executive";
  const from = searchParams.get("from") ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const token = searchParams.get("token");

  if (!token || token !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20)) {
    return NextResponse.json({ error: "Valid BI token required. Use ?token=your_bi_token" }, { status: 401 });
  }

  try {
    let data: unknown[] = [];
    let schema: Array<{ name: string; type: string }> = [];

    if (dataset === "executive") {
      const { data: execData } = await supabase.from("analytics_revenue_daily")
        .select("*")
        .gte("metric_date", from)
        .lte("metric_date", to)
        .order("metric_date", { ascending: false })
        .limit(1000);

      if (execData) {
        data = execData;
        schema = [
          { name: "metric_date", type: "date" },
          { name: "gross_revenue", type: "number" },
          { name: "membership_revenue", type: "number" },
          { name: "renewal_revenue", type: "number" },
          { name: "pt_revenue", type: "number" },
          { name: "class_revenue", type: "number" },
          { name: "paid_payments", type: "integer" },
          { name: "paying_members", type: "integer" }
        ];
      }
    } else if (dataset === "membership") {
      const { data: memData } = await supabase.from("analytics_membership_daily")
        .select("*")
        .gte("metric_date", from)
        .lte("metric_date", to)
        .order("metric_date", { ascending: false })
        .limit(1000);

      if (memData) {
        data = memData;
        schema = [
          { name: "metric_date", type: "date" },
          { name: "memberships_created", type: "integer" },
          { name: "active_memberships", type: "integer" },
          { name: "expired_memberships", type: "integer" },
          { name: "renewals", type: "integer" }
        ];
      }
    } else if (dataset === "leads") {
      const { data: leadsData } = await supabase.from("analytics_lead_funnel").select("*").limit(100);
      if (leadsData) { data = leadsData as unknown[]; schema = [{ name: "source", type: "text" }, { name: "status", type: "text" }, { name: "leads", type: "integer" }]; }
    } else if (dataset === "forecast") {
      const { data: forecastData } = await (supabase.rpc as any)("forecast_metric", { p_metric_query: "select sum(gross_revenue) as value from analytics_revenue_daily where metric_date >= current_date - 90", p_horizon_days: 30, p_seasonality_days: 7 });
      if (forecastData) { data = forecastData; }
    } else if (dataset === "churn_prediction") {
      const { data: churnData } = await (supabase.rpc as any)("predict_churn_risk", { p_tenant_id: null });
      if (churnData) { data = churnData; }
    }

    if (format === "csv") {
      if (data.length === 0) return new Response("No data", { status: 200 });
      const headers = Object.keys(data[0] as Record<string, unknown>);
      const csvRows = [
        headers.join(","),
        ...data.map((row) => headers.map((h) => String((row as Record<string, unknown>)[h] ?? "")).join(","))
      ];
      return new Response(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${dataset}_${from}_${to}.csv"`
        }
      });
    }

    return NextResponse.json({
      dataset,
      generated_at: new Date().toISOString(),
      row_count: data.length,
      schema,
      data,
      meta: {
        description: "Enterprise BI data feed for Power BI, Tableau, Looker, and custom analytics",
        refresh_rate: "Every 60 seconds",
        documentation_url: "/api/analytics/bi",
        available_datasets: ["executive", "membership", "leads", "forecast", "churn_prediction", "branch_performance", "trainer_performance", "marketing_campaigns"]
      }
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
