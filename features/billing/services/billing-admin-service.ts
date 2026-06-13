import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BillingMetricsSummary } from "../types/billing-extended";

type QueryRes = Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
type SelectResult = {
  eq(c: string, v: string): SelectResult & QueryRes;
  gte(c: string, v: string): SelectResult & QueryRes;
  lte(c: string, v: string): SelectResult & QueryRes;
  in(c: string, v: string[]): SelectResult & QueryRes;
  order(c: string, o: { ascending: boolean }): QueryRes & { limit(n: number): QueryRes };
};

async function getDb() {
  const supabase = await createSupabaseServerClient();
  return supabase as never as {
    from(t: string): { select(c: string, o?: Record<string, unknown>): SelectResult };
  };
}

export async function getBillingSummary(): Promise<BillingMetricsSummary> {
  const adminDb = await getDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [invoicesRes, paymentsRes, refundsRes, disputesRes] = await Promise.all([
    adminDb.from("invoices").select("*").eq("status", "paid").gte("paid_at", monthStart).order("created_at", { ascending: false }),
    adminDb.from("payments").select("*").eq("status", "paid").gte("paid_at", monthStart).order("created_at", { ascending: false }),
    adminDb.from("refunds").select("*").eq("status", "processed").gte("processed_at", monthStart).order("created_at", { ascending: false }),
    adminDb.from("disputes").select("*").eq("status", "opened").order("created_at", { ascending: false }),
  ]);

  const invoices = invoicesRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const refunds = refundsRes.data ?? [];
  const disputes = disputesRes.data ?? [];

  const totalInvoicedMonth = invoices.reduce((s, i) => s + ((i.total_amount as number) || 0), 0);
  const totalCollectedMonth = payments.reduce((s, p) => s + ((p.amount as number) || 0), 0);
  const totalRefundedMonth = refunds.reduce((s, r) => s + ((r.amount as number) || 0), 0);
  const openDisputeAmount = disputes.reduce((s, d) => s + ((d.amount as number) || 0), 0);

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  const [prevMonthRes] = await Promise.all([
    adminDb.from("payments").select("*").eq("status", "paid").gte("paid_at", prevMonthStart).lte("paid_at", prevMonthEnd),
  ]);
  const prevMonthTotal = (prevMonthRes.data ?? []).reduce((s, p) => s + ((p.amount as number) || 0), 0);

  const [outstandingRes] = await Promise.all([
    adminDb.from("invoices").select("*").in("status", ["issued", "partially_paid"]).order("created_at", { ascending: false }),
  ]);
  const totalOutstanding = (outstandingRes.data ?? []).reduce((s, i) => s + (((i.amount_due as number) || 0)), 0);

  const monthOverMonthGrowth = prevMonthTotal > 0 ? Math.round(((totalCollectedMonth - prevMonthTotal) / prevMonthTotal) * 100) : 0;

  const [creditNotesRes] = await Promise.all([
    adminDb.from("credit_notes").select("*").gte("created_at", monthStart).order("created_at", { ascending: false }),
  ]);
  const creditNotes = creditNotesRes.data ?? [];
  const creditNotesIssued = creditNotes.filter((c) => c.status === "issued" || c.status === "applied" || c.status === "fully_applied").length;
  const creditNotesApplied = creditNotes.filter((c) => c.status === "applied" || c.status === "fully_applied").length;

  const [writeOffsRes] = await Promise.all([
    adminDb.from("write_offs").select("*").eq("status", "applied").order("created_at", { ascending: false }),
  ]);
  const totalWrittenOff = (writeOffsRes.data ?? []).reduce((s, w) => s + ((w.amount as number) || 0), 0);

  const [reconRes] = await Promise.all([
    adminDb.from("reconciliation").select("*").eq("status", "unmatched").order("created_at", { ascending: false }),
  ]);
  const pendingReconciliationCount = reconRes.data?.length ?? 0;

  return {
    totalInvoicedMonth,
    totalCollectedMonth,
    totalRefundedMonth,
    totalOutstanding,
    totalWrittenOff,
    openDisputesCount: disputes.length,
    openDisputeAmount,
    pendingReconciliationCount,
    creditNotesIssued,
    creditNotesApplied,
    monthOverMonthGrowth,
  };
}

export async function getDetailedBillingData() {
  const adminDb = await getDb();
  const [invoices, payments, refunds, transactions] = await Promise.all([
    adminDb.from("invoices").select("*").order("created_at", { ascending: false }).limit(50),
    adminDb.from("payments").select("*").order("created_at", { ascending: false }).limit(50),
    adminDb.from("refunds").select("*").order("created_at", { ascending: false }).limit(50),
    adminDb.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  return {
    invoices: (invoices as unknown as QueryRes extends Promise<infer R> ? R : never).data ?? [],
    payments: (payments as unknown as QueryRes extends Promise<infer R> ? R : never).data ?? [],
    refunds: (refunds as unknown as QueryRes extends Promise<infer R> ? R : never).data ?? [],
    transactions: (transactions as unknown as QueryRes extends Promise<infer R> ? R : never).data ?? [],
  };
}

export async function getCreditNotes(options?: { limit?: number }) {
  const adminDb = await getDb();
  const res = await adminDb.from("credit_notes").select("*").order("created_at", { ascending: false }).limit(options?.limit ?? 20);
  return ((res as unknown as { data: Array<Record<string, unknown>> | null }).data) ?? [];
}

export async function getWriteOffs(options?: { limit?: number }) {
  const adminDb = await getDb();
  const res = await adminDb.from("write_offs").select("*").order("created_at", { ascending: false }).limit(options?.limit ?? 20);
  return ((res as unknown as { data: Array<Record<string, unknown>> | null }).data) ?? [];
}

export async function getDisputes(options?: { limit?: number }) {
  const adminDb = await getDb();
  const res = await adminDb.from("disputes").select("*").order("created_at", { ascending: false }).limit(options?.limit ?? 20);
  return ((res as unknown as { data: Array<Record<string, unknown>> | null }).data) ?? [];
}

export async function getReconciliationEntries(options?: { limit?: number }) {
  const adminDb = await getDb();
  const res = await adminDb.from("reconciliation").select("*").order("created_at", { ascending: false }).limit(options?.limit ?? 20);
  return ((res as unknown as { data: Array<Record<string, unknown>> | null }).data) ?? [];
}

export async function getRevenueRecognitionEntries(options?: { limit?: number }) {
  const adminDb = await getDb();
  const res = await adminDb.from("revenue_recognition").select("*").order("recognized_date", { ascending: false }).limit(options?.limit ?? 20);
  return ((res as unknown as { data: Array<Record<string, unknown>> | null }).data) ?? [];
}

export async function getOrgSubscriptionInvoices(options?: { limit?: number }) {
  const adminDb = await getDb();
  const res = await adminDb.from("org_subscription_invoices").select("*").order("created_at", { ascending: false }).limit(options?.limit ?? 20);
  return ((res as unknown as { data: Array<Record<string, unknown>> | null }).data) ?? [];
}

export async function getOrgSubscriptionPayments(options?: { limit?: number }) {
  const adminDb = await getDb();
  const res = await adminDb.from("org_subscription_payments").select("*").order("created_at", { ascending: false }).limit(options?.limit ?? 20);
  return ((res as unknown as { data: Array<Record<string, unknown>> | null }).data) ?? [];
}

export async function getSubscriptionRevenueMetrics(): Promise<{ totalInvoicedMonth: number; totalCollectedMonth: number; totalOutstanding: number; invoiceCount: number }> {
  const adminDb = await getDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [invoicesRes, paymentsRes] = await Promise.all([
    adminDb.from("org_subscription_invoices").select("*").gte("created_at", monthStart).order("created_at", { ascending: false }),
    adminDb.from("org_subscription_payments").select("*").eq("status", "paid").gte("paid_at", monthStart).order("created_at", { ascending: false }),
  ]);

  const invoices = (invoicesRes as unknown as { data: Array<Record<string, unknown>> | null }).data ?? [];
  const payments = (paymentsRes as unknown as { data: Array<Record<string, unknown>> | null }).data ?? [];

  const totalInvoicedMonth = invoices.reduce((s, i) => s + ((i.total_amount as number) || 0), 0);
  const totalCollectedMonth = payments.reduce((s, p) => s + ((p.amount as number) || 0), 0);

  const outstandingRes = await adminDb.from("org_subscription_invoices").select("*").in("status", ["issued", "partially_paid"]).order("created_at", { ascending: false });
  const outstanding = (outstandingRes as unknown as { data: Array<Record<string, unknown>> | null }).data ?? [];
  const totalOutstanding = outstanding.reduce((s, i) => s + ((i.amount_due as number) || 0), 0);

  return { totalInvoicedMonth, totalCollectedMonth, totalOutstanding, invoiceCount: invoices.length };
}
