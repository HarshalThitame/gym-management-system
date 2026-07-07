import type { DbClient } from "./db-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchRazorpayCapturedPayments } from "@/features/billing/razorpay/razorpay-service";
import { billingLogger } from "@/features/billing/lib/logger";


function getDb(supabase: unknown): DbClient { return supabase as never as DbClient; }

export async function runDailyReconciliation(gymId: string, date: string, provider: string = "razorpay"): Promise<{
  ok: boolean;
  message: string;
  gatewayAmount: number;
  systemAmount: number;
  difference: number;
}> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const { data: payments } = await db.from("payments")
    .select("*")
    .eq("provider", provider)
    .eq("status", "paid")
    .gte("paid_at", dayStart)
    .lte("paid_at", dayEnd);

  const systemAmount = (payments ?? []).reduce((s, p) => s + ((p.amount as number) || 0), 0);

  const fromDate = new Date(`${date}T00:00:00.000Z`);
  const toDate = new Date(`${date}T23:59:59.999Z`);
  let gatewayAmount = 0;

  const gatewayResult = await fetchRazorpayCapturedPayments(fromDate, toDate);
  if (gatewayResult.ok) {
    gatewayAmount = gatewayResult.data.reduce((sum, p) => sum + p.amount, 0);
  } else {
    billingLogger.warn("runDailyReconciliation", "Could not fetch from Razorpay, using system amount as fallback", { gymId, date, error: gatewayResult.message });
    gatewayAmount = systemAmount;
  }

  const difference = gatewayAmount - systemAmount;
  const status = difference === 0 ? "matched" : "unmatched";

  const { data: existing } = await db.from("reconciliation")
    .select("*")
    .eq("gym_id", gymId)
    .eq("date", date)
    .eq("provider", provider)
    .maybeSingle();

  if (existing) {
    await db.from("reconciliation").update({
      gateway_amount: gatewayAmount,
      system_amount: systemAmount,
      status: difference === 0 ? "matched" : "unmatched",
    }).eq("id", existing.id as string);
  } else {
    await db.from("reconciliation").insert({
      gym_id: gymId,
      date,
      provider,
      gateway_amount: gatewayAmount,
      system_amount: systemAmount,
      status,
    });
  }

  return {
    ok: true,
    message: difference === 0 ? "Reconciled — fully matched." : `Mismatch: ₹${(Math.abs(difference) / 100).toFixed(2)} difference found.`,
    gatewayAmount,
    systemAmount,
    difference,
  };
}

export async function flagDiscrepancy(reconciliationId: string, notes: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { error } = await db.from("reconciliation").update({
    status: "flagged",
    notes,
  }).eq("id", reconciliationId);

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Discrepancy flagged for review." };
}

export async function resolveDiscrepancy(reconciliationId: string, notes: string, resolvedBy: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { error } = await db.from("reconciliation").update({
    status: "resolved",
    notes,
    reconciled_by: resolvedBy,
    reconciled_at: new Date().toISOString(),
  }).eq("id", reconciliationId);

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Discrepancy resolved." };
}

export async function getReconciliationSummary(gymId: string, fromDate: string, toDate: string): Promise<{
  totalDays: number;
  matchedDays: number;
  unmatchedDays: number;
  flaggedDays: number;
  totalDifference: number;
}> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: entries } = await db.from("reconciliation")
    .select("*")
    .eq("gym_id", gymId)
    .gte("date", fromDate)
    .lte("date", toDate);

  const rows = entries ?? [];
  return {
    totalDays: rows.length,
    matchedDays: rows.filter((r) => (r.status as string) === "matched").length,
    unmatchedDays: rows.filter((r) => (r.status as string) === "unmatched").length,
    flaggedDays: rows.filter((r) => (r.status as string) === "flagged").length,
    totalDifference: rows.reduce((s, r) => s + ((r.difference as number) || 0), 0),
  };
}
