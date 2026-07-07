import type { DbClient } from "./db-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";


function getDb(supabase: unknown): DbClient { return supabase as never as DbClient; }

export type RevenueScheduleEntry = {
  periodStart: string;
  periodEnd: string;
  recognizedAmount: number;
  deferredAmount: number;
  status: "pending" | "recognized" | "deferred";
};

export async function recognizeRevenue(invoiceId: string): Promise<{ ok: boolean; message: string; schedule?: RevenueScheduleEntry[] }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: invoice } = await db.from("invoices").select("*").eq("id", invoiceId).single();
  if (!invoice) return { ok: false, message: "Invoice not found." };

  const totalAmount = (invoice.total_amount as number) || 0;
  const gymId = invoice.gym_id as string | null;
  const memberId = invoice.member_id as string | null;
  const status = invoice.status as string;

  if (status !== "paid") return { ok: false, message: "Revenue can only be recognized for paid invoices." };

  const { data: membership } = await db.from("memberships").select("*").eq("member_id", memberId).maybeSingle();

  if (!gymId) return { ok: false, message: "Invoice has no gym." };

  let periodStart: string;
  let periodEnd: string | null;
  let durationDays: number;

  if (membership) {
    periodStart = (membership.start_date as string) || (invoice.issued_at as string) || new Date().toISOString();
    periodEnd = (membership.end_date as string) || null;
    durationDays = periodEnd
      ? Math.max(1, Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000))
      : 30;
  } else {
    const invoiceIssuedAt = (invoice.issued_at as string) || new Date().toISOString();
    const invoiceDueAt = (invoice.due_at as string) || null;
    periodStart = invoiceIssuedAt;

    if (invoiceDueAt) {
      const daysBetween = Math.max(1, Math.round((new Date(invoiceDueAt).getTime() - new Date(invoiceIssuedAt).getTime()) / 86400000));
      durationDays = Math.max(daysBetween, 30);
      const end = new Date(invoiceIssuedAt);
      end.setDate(end.getDate() + durationDays);
      periodEnd = end.toISOString();
    } else {
      durationDays = 30;
      const end = new Date(invoiceIssuedAt);
      end.setDate(end.getDate() + durationDays);
      periodEnd = end.toISOString();
    }
  }

  const dailyRate = Math.round(totalAmount / durationDays);
  const today = new Date();
  const startDate = new Date(periodStart);
  const endDate = periodEnd ? new Date(periodEnd) : new Date(today.getTime() + durationDays * 86400000);

  const elapsedDays = Math.max(0, Math.round((today.getTime() - startDate.getTime()) / 86400000));
  const recognizedAmount = Math.min(totalAmount, dailyRate * Math.min(elapsedDays, durationDays));
  const deferredAmount = totalAmount - recognizedAmount;

  await db.from("revenue_recognition").insert({
    gym_id: gymId,
    invoice_id: invoiceId,
    recognized_amount: recognizedAmount,
    deferred_amount: deferredAmount,
    recognized_date: today.toISOString().slice(0, 10),
    period_start: periodStart.slice(0, 10),
    period_end: endDate.toISOString().slice(0, 10),
    status: deferredAmount > 0 ? "deferred" : "recognized",
  });

  return {
    ok: true,
    message: `Revenue recognized: ${recognizedAmount} recognized, ${deferredAmount} deferred over ${durationDays} days.`,
    schedule: [{
      periodStart: periodStart.slice(0, 10),
      periodEnd: endDate.toISOString().slice(0, 10),
      recognizedAmount,
      deferredAmount,
      status: deferredAmount > 0 ? "deferred" : "recognized",
    }],
  };
}

export async function runBatchRevenueRecognition(): Promise<{ processed: number; errors: string[] }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: unpaid } = await db.from("revenue_recognition").select("*").eq("status", "pending");
  const pendingInvoices = (unpaid ?? []) as Array<{ invoice_id: string }>;

  let processed = 0;
  const errors: string[] = [];

  for (const entry of pendingInvoices) {
    const result = await recognizeRevenue(entry.invoice_id);
    if (result.ok) processed++;
    else errors.push(`Invoice ${entry.invoice_id}: ${result.message}`);
  }

  return { processed, errors };
}

export async function getRevenueRecognitionStatus(invoiceId: string): Promise<Array<Record<string, unknown>>> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);
  const { data } = await db.from("revenue_recognition").select("*").eq("invoice_id", invoiceId);
  return data ?? [];
}

export async function getDeferredRevenueSummary(gymId: string): Promise<{
  totalDeferred: number;
  totalRecognized: number;
  pendingCount: number;
}> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: entries } = await db.from("revenue_recognition").select("*").eq("gym_id", [gymId]);

  const rows = entries ?? [];
  const totalDeferred = rows.reduce((s, r) => s + ((r.deferred_amount as number) || 0), 0);
  const totalRecognized = rows.reduce((s, r) => s + ((r.recognized_amount as number) || 0), 0);
  const pendingCount = rows.filter((r) => (r.status as string) === "pending").length;

  return { totalDeferred, totalRecognized, pendingCount };
}
