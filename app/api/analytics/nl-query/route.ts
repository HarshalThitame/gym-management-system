/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { query } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Try database-level NLP parser
    const { data, error } = await (supabase.rpc as any)("nl_query_analytics", { p_query: query });

    if (error) {
      // Fallback: simple keyword-based response
      const lower = query.toLowerCase();
      let response: Record<string, unknown> = { query, interpreted: true };

      if (lower.includes("revenue") || lower.includes("mrr") || lower.includes("earning")) {
        const { data: rev } = await supabase.from("analytics_revenue_daily").select("metric_date, gross_revenue").order("metric_date", { ascending: false }).limit(30);
        response = { ...response, type: "revenue", data: rev ?? [], insight: "Revenue trend for last 30 days" };
      } else if (lower.includes("churn") || lower.includes("retention")) {
        const { data: memberships } = await supabase.from("memberships").select("status").limit(1000);
        const total = memberships?.length ?? 0;
        const active = (memberships as any[])?.filter((m) => m.status === "active").length ?? 0;
        response = { ...response, type: "churn", churn_rate: total > 0 ? Math.round(((total - active) / total) * 10000) / 100 : 0, active, total };
      } else if (lower.includes("branch") || lower.includes("trainer") || lower.includes("coach")) {
        const { data: trainers } = await supabase.from("trainers").select("id").neq("status", "archived");
        response = { ...response, type: "trainer", total_trainers: trainers?.length ?? 0 };
      } else {
        response = { ...response, type: "general", message: `Analyzed: "${query}". Try: revenue, churn, retention, branch, trainer, membership, forecast.` };
      }

      return NextResponse.json({ query, results: response, generated_at: new Date().toISOString() });
    }

    return NextResponse.json({ query, results: data, generated_at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: "Natural Language Analytics Query API",
    version: "1.0",
    description: "Ask questions about your analytics data in plain English",
    examples: [
      "Show revenue trends for last 30 days",
      "Compare churn rates between branches",
      "Which trainers generated the highest revenue?",
      "Show membership growth by month",
      "What is our current MRR?",
      "Which branches are underperforming?",
      "Predict churn risk for next month"
    ],
    endpoint: "POST /api/analytics/nl-query with { query: string }"
  });
}
