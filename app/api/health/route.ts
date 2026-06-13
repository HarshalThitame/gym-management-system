import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type HealthStatus = "ok" | "degraded" | "down";
type HealthCheck = { status: HealthStatus; latencyMs: number; message?: string | undefined };

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  const checks: Record<string, HealthCheck> = {};

  // Supabase connectivity check
  const supabaseStart = Date.now();
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      checks.supabase = { status: "down", latencyMs: Date.now() - supabaseStart, message: "Admin client not initialized" };
    } else {
      const { error } = await supabase.from("organizations").select("id", { count: "exact", head: true }).limit(1);
      checks.supabase = {
        status: error ? "degraded" : "ok",
        latencyMs: Date.now() - supabaseStart,
        message: error ? error.message : undefined,
      };
    }
  } catch (err) {
    checks.supabase = { status: "down", latencyMs: Date.now() - supabaseStart, message: err instanceof Error ? err.message : "Unknown error" };
  }

  // App version / environment info
  const nodeVersion = process.version;
  const environment = process.env.NODE_ENV ?? "development";

  const overallStatus: HealthStatus = Object.values(checks).some((c) => c.status === "down") ? "down"
    : Object.values(checks).some((c) => c.status === "degraded") ? "degraded" : "ok";

  const totalLatency = Date.now() - start;
  const statusCode = overallStatus === "ok" ? 200 : overallStatus === "degraded" ? 200 : 503;

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment,
    nodeVersion,
    totalLatencyMs: totalLatency,
    checks,
  }, { status: statusCode });
}
