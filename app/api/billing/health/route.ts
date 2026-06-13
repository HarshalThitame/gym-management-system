import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const checks: Record<string, string> = {};

  checks.timestamp = new Date().toISOString();
  checks.status = "ok";

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("invoices").select("id", { count: "exact", head: true });
    checks.database = error ? `error: ${error.message}` : "connected";
  } catch (e) {
    checks.database = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }

  checks.razorpayKey = process.env.RAZORPAY_KEY_ID ? "configured" : "missing";
  checks.razorpaySecret = process.env.RAZORPAY_KEY_SECRET ? "configured" : "missing";
  checks.cronSecret = process.env.CRON_SECRET ? "configured" : "missing";

  const allOk = Object.values(checks).every((v) => v !== "error" && !v.startsWith("error"));
  const status = allOk ? 200 : 503;

  return NextResponse.json({ ok: allOk, checks }, { status });
}
