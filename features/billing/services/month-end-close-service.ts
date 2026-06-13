import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FinancialPeriod, MonthEndCloseResult } from "../types/billing-extended";

type DbResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type DB = {
  from(t: string): {
    select(c: string): {
      eq(c: string, v: unknown): {
        eq(c2: string, v2: unknown): DbResult<Array<Record<string, unknown>>>;
        gte(c: string, v: string): {
          lte(c2: string, v2: string): DbResult<Array<Record<string, unknown>>>;
        };
        order(c: string, o: { ascending: boolean }): { limit(n: number): DbResult<Array<Record<string, unknown>>> };
      };
      gte(c: string, v: string): {
        lte(c2: string, v2: string): DbResult<Array<Record<string, unknown>>>;
      };
      order(c: string, o: { ascending: boolean }): { limit(n: number): DbResult<Array<Record<string, unknown>>> };
    };
    insert(r: Record<string, unknown>): {
      select(c: string): DbResult<Array<Record<string, unknown>>>;
    };
    update(r: Record<string, unknown>): {
      eq(c: string, v: unknown): Promise<{ error: { message: string } | null }>;
    };
  };
};

async function getDb() {
  const supabase = await createSupabaseServerClient();
  return supabase as never as DB;
}

export async function getFinancialPeriods(gymId: string): Promise<FinancialPeriod[]> {
  const db = await getDb();
  const { data } = await db
    .from("financial_periods")
    .select("")
    .eq("gym_id", gymId)
    .order("period_start", { ascending: false })
    .limit(24);
  return (data ?? []) as unknown as FinancialPeriod[];
}

export async function getOpenFinancialPeriod(gymId: string): Promise<FinancialPeriod | null> {
  const db = await getDb();
  const { data } = await db
    .from("financial_periods")
    .select("")
    .eq("gym_id", gymId)
    .order("period_start", { ascending: false })
    .limit(1);
  return ((data ?? [])[0] ?? null) as unknown as FinancialPeriod | null;
}

export async function openNewFinancialPeriod(gymId: string, periodStart: string, periodEnd: string): Promise<FinancialPeriod> {
  const db = await getDb();
  const { data } = await db
    .from("financial_periods")
    .insert({
      gym_id: gymId,
      period_start: periodStart,
      period_end: periodEnd,
      status: "open",
      lock_version: 1,
    })
    .select("");
  if (!data || data.length === 0) throw new Error("Failed to create financial period");
  return data[0] as unknown as FinancialPeriod;
}

export async function performMonthEndClose(gymId: string, periodId: string, closedBy: string): Promise<MonthEndCloseResult> {
  const db = await getDb();

  const { data: period } = await db
    .from("financial_periods")
    .select("")
    .eq("id", periodId)
    .eq("gym_id", gymId);

  const current = ((period ?? [])[0] ?? null) as unknown as FinancialPeriod | null;
  if (!current) throw new Error("Financial period not found");
  if (current.status === "closed") throw new Error("Period is already closed");

  const pStart = current.period_start;
  const pEnd = current.period_end;

  const [invRes, payRes, refRes] = await Promise.all([
    db.from("invoices").select("").eq("gym_id", gymId).gte("created_at", pStart).lte("created_at", pEnd),
    db.from("payments").select("").eq("gym_id", gymId).gte("paid_at", pStart).lte("paid_at", pEnd),
    db.from("refunds").select("").eq("gym_id", gymId).gte("processed_at", pStart).lte("processed_at", pEnd),
  ]);

  const totalRevenue = (payRes.data ?? []).reduce((s, p) => s + ((p.amount as number) || 0), 0);
  const totalRefunds = (refRes.data ?? []).reduce((s, r) => s + ((r.amount as number) || 0), 0);
  const netIncome = totalRevenue - totalRefunds;

  await db.from("financial_periods").update({
    status: "closed",
    closed_by: closedBy,
    closed_at: new Date().toISOString(),
    lock_version: current.lock_version + 1,
  }).eq("id", periodId);

  const previousClosed = true;

  return {
    periodId: current.id,
    periodStart: current.period_start,
    periodEnd: current.period_end,
    status: "closed",
    totalRevenue,
    totalExpenses: totalRefunds,
    netIncome,
    invoiceCount: (invRes.data ?? []).length,
    paymentCount: (payRes.data ?? []).length,
    refundCount: (refRes.data ?? []).length,
    previousPeriodClosed: previousClosed,
  };
}
