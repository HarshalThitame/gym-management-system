import type { DbClient } from "./db-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";


function getDb(supabase: unknown): DbClient { return supabase as never as DbClient; }

export type RequestWriteOffInput = {
  gymId: string;
  invoiceId?: string | null;
  paymentId?: string | null;
  amount: number;
  currency?: string;
  reason: string;
  requestedBy: string;
};

export async function requestWriteOff(input: RequestWriteOffInput): Promise<{ ok: boolean; message: string; writeOffId?: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: writeOff } = await db.from("write_offs").insert({
    gym_id: input.gymId,
    invoice_id: input.invoiceId ?? null,
    payment_id: input.paymentId ?? null,
    amount: input.amount,
    currency: input.currency ?? "INR",
    reason: input.reason,
    status: "pending_approval",
    requested_by: input.requestedBy,
  });

  if (!writeOff) return { ok: false, message: "Failed to create write-off request." };

  return { ok: true, message: "Write-off request submitted for approval.", writeOffId: writeOff.id as string };
}

export async function approveWriteOff(writeOffId: string, approvedBy: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: existing } = await db.from("write_offs").select("*").eq("id", writeOffId).single();
  if (!existing) return { ok: false, message: "Write-off not found." };
  if ((existing.status as string) !== "pending_approval") return { ok: false, message: "Write-off is not pending approval." };

  const { error } = await db.from("write_offs").update({
    status: "approved",
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
  }).eq("id", writeOffId);

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Write-off approved." };
}

export async function rejectWriteOff(writeOffId: string, reason?: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const payload: Record<string, unknown> = { status: "rejected" };
  if (reason) payload.reason = reason;

  const { error } = await db.from("write_offs").update(payload).eq("id", writeOffId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Write-off rejected." };
}

export async function applyWriteOff(writeOffId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: existing } = await db.from("write_offs").select("*").eq("id", writeOffId).single();
  if (!existing) return { ok: false, message: "Write-off not found." };
  if ((existing.status as string) !== "approved") return { ok: false, message: "Write-off must be approved before applying." };

  const { error } = await db.from("write_offs").update({
    status: "applied",
  }).eq("id", writeOffId);

  if (error) return { ok: false, message: error.message };

  await db.from("transactions").insert({
    gym_id: existing.gym_id,
    invoice_id: existing.invoice_id ?? null,
    payment_id: existing.payment_id ?? null,
    transaction_type: "refund_processed",
    direction: "credit",
    amount: existing.amount,
    currency: existing.currency ?? "INR",
    description: `Write-off applied: ${(existing.reason as string) ?? "Bad debt"}`,
  });

  if (existing.invoice_id) {
    await db.from("invoices").update({
      status: "cancelled",
    }).eq("id", existing.invoice_id as string);
  }

  return { ok: true, message: "Write-off applied to financials." };
}

export async function getWriteOffSummary(gymId: string): Promise<{
  pendingApproval: number;
  approved: number;
  applied: number;
  rejected: number;
  totalAmount: number;
}> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: all } = await db.from("write_offs").select("*").eq("gym_id", [gymId]);

  const rows = all ?? [];
  return {
    pendingApproval: rows.filter((r) => (r.status as string) === "pending_approval").length,
    approved: rows.filter((r) => (r.status as string) === "approved").length,
    applied: rows.filter((r) => (r.status as string) === "applied").length,
    rejected: rows.filter((r) => (r.status as string) === "rejected").length,
    totalAmount: rows.reduce((s, r) => s + ((r.amount as number) || 0), 0),
  };
}
