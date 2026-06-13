/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const metric = searchParams.get("metric") ?? "revenue";
  const days = parseInt(searchParams.get("days") ?? "30", 10);

  try {
    const anomalies: Array<{ metric: string; date: string; value: number; zscore: number; direction: string }> = [];

    if (metric === "revenue" || metric === "all") {
      const { data: raw } = await (supabase as any)
        .from("analytics_revenue_daily")
        .select("metric_date, gross_revenue")
        .gte("metric_date", new Date(Date.now() - days * 86400000).toISOString().slice(0, 10))
        .order("metric_date", { ascending: false })
        .limit(90);

      const revAnomalies = (raw ?? []) as Array<{ metric_date: string; gross_revenue: number }>;

      if (revAnomalies.length > 0) {
        const values = revAnomalies.map((r) => Number(r.gross_revenue));
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((sq, v) => sq + Math.pow(v - mean, 2), 0) / values.length);

        for (const row of revAnomalies) {
          const v = Number(row.gross_revenue);
          const z = std > 0 ? (v - mean) / std : 0;
          if (Math.abs(z) > 2.5) {
            anomalies.push({ metric: "revenue", date: row.metric_date, value: v, zscore: Math.round(z * 100) / 100, direction: z > 0 ? "spike" : "drop" });
          }
        }
      }
    }

    return NextResponse.json({ anomalies, detected_at: new Date().toISOString(), metric, lookback_days: days });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
