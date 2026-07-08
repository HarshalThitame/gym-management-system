import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PaymentMethodBreakdown = {
  method: string;
  count: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  failedCount: number;
  failedAmount: number;
};

export type ProviderBreakdown = {
  provider: string;
  count: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  failedCount: number;
  failedAmount: number;
};

export type DailyPaymentSummary = {
  date: string;
  count: number;
  amount: number;
};

export type PaymentTrackingSummary = {
  methodBreakdown: PaymentMethodBreakdown[];
  providerBreakdown: ProviderBreakdown[];
  dailyTrend: DailyPaymentSummary[];
  totalPayments: number;
  totalAmount: number;
  paidAmount: number;
  failedAmount: number;
  refundedAmount: number;
  successRate: number;
  last30DaysPaid: number;
  last30DaysFailed: number;
};

function buildBreakdowns(rows: Array<{ method: string; provider: string; amount: number; status: string; created_at: string }>) {
  const methodMap = new Map<string, PaymentMethodBreakdown>();
  const providerMap = new Map<string, ProviderBreakdown>();

  for (const p of rows) {
    const method = p.method || "unknown";
    if (!methodMap.has(method)) {
      methodMap.set(method, { method, count: 0, totalAmount: 0, paidCount: 0, paidAmount: 0, failedCount: 0, failedAmount: 0 });
    }
    const mEntry = methodMap.get(method)!;
    mEntry.count++;
    mEntry.totalAmount += p.amount;
    if (p.status === "paid") {
      mEntry.paidCount++;
      mEntry.paidAmount += p.amount;
    } else if (p.status === "failed") {
      mEntry.failedCount++;
      mEntry.failedAmount += p.amount;
    }

    const provider = p.provider || "manual";
    if (!providerMap.has(provider)) {
      providerMap.set(provider, { provider, count: 0, totalAmount: 0, paidCount: 0, paidAmount: 0, failedCount: 0, failedAmount: 0 });
    }
    const pEntry = providerMap.get(provider)!;
    pEntry.count++;
    pEntry.totalAmount += p.amount;
    if (p.status === "paid") {
      pEntry.paidCount++;
      pEntry.paidAmount += p.amount;
    } else if (p.status === "failed") {
      pEntry.failedCount++;
      pEntry.failedAmount += p.amount;
    }
  }

  return { methodMap, providerMap };
}

async function fetchPayments(gymId?: string) {
  const supabase = await createSupabaseServerClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const query = supabase.from("payments").select("*").gte("created_at", thirtyDaysAgo.toISOString());
  if (gymId) query.eq("gym_id", gymId);
  query.order("created_at", { ascending: false });

  const { data: payments } = await query;
  return payments ?? [];
}

async function fetchRefundedAmount(gymId?: string) {
  const supabase = await createSupabaseServerClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let query = supabase.from("refunds").select("amount, status").gte("created_at", thirtyDaysAgo.toISOString());
  const { data: refunds } = await query;
  return (refunds ?? [])
    .filter((r: Record<string, unknown>) => r.status === "processed" || r.status === "approved")
    .reduce((sum: number, r: Record<string, unknown>) => sum + (r.amount as number), 0);
}

export async function getPaymentTrackingSummary(gymId: string): Promise<PaymentTrackingSummary> {
  const [rows, refundedAmount] = await Promise.all([fetchPayments(gymId), fetchRefundedAmount(gymId)]);
  return computeSummary(rows, refundedAmount);
}

export async function getPaymentTrackingSummarySuperAdmin(): Promise<PaymentTrackingSummary> {
  const [rows, refundedAmount] = await Promise.all([fetchPayments(), fetchRefundedAmount()]);
  return computeSummary(rows, refundedAmount);
}

function computeSummary(rows: Array<Record<string, unknown>>, refundedAmount = 0) {
  const typed = rows as Array<{ method: string; provider: string; amount: number; status: string; created_at: string }>;

  const { methodMap, providerMap } = buildBreakdowns(typed);

  const dayMap = new Map<string, DailyPaymentSummary>();
  for (const p of typed) {
    const day = p.created_at?.slice(0, 10);
    if (!day) continue;
    if (!dayMap.has(day)) {
      dayMap.set(day, { date: day, count: 0, amount: 0 });
    }
    const entry = dayMap.get(day)!;
    entry.count++;
    if (p.status === "paid") {
      entry.amount += p.amount;
    }
  }

  const dailyTrend = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const totalPayments = typed.length;
  const totalAmount = typed.reduce((s, p) => s + p.amount, 0);
  const paidAmount = typed.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const failedAmount = typed.filter((p) => p.status === "failed").reduce((s, p) => s + p.amount, 0);
  const paidCount = typed.filter((p) => p.status === "paid").length;
  const failedCount = typed.filter((p) => p.status === "failed").length;
  const successRate = paidCount + failedCount > 0 ? (paidCount / (paidCount + failedCount)) * 100 : 0;

  return {
    methodBreakdown: Array.from(methodMap.values()),
    providerBreakdown: Array.from(providerMap.values()),
    dailyTrend,
    totalPayments,
    totalAmount,
    paidAmount,
    failedAmount,
    refundedAmount,
    successRate,
    last30DaysPaid: paidCount,
    last30DaysFailed: failedCount,
  };
}
