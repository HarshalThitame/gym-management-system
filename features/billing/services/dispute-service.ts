import type { DbClient } from "./db-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";


function getDb(supabase: any): DbClient { return supabase as never as DbClient; }

const VALID_REASONS = [
  "duplicate_charge", "product_not_received", "service_not_as_described",
  "subscription_cancelled", "amount_incorrect", "fraudulent", "other",
] as const;

export type OpenDisputeInput = {
  gymId: string;
  paymentId: string;
  invoiceId?: string | null;
  memberId: string;
  reason: typeof VALID_REASONS[number];
  description: string;
  amount: number;
  currency?: string;
  evidenceNotes?: string | null;
};

export async function openDispute(input: OpenDisputeInput): Promise<{ ok: boolean; message: string; disputeId?: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: payment } = await db.from("payments").select("*").eq("id", input.paymentId).single();
  if (!payment) return { ok: false, message: "Payment not found." };

  const { data: existing } = await db.from("disputes").select("*").eq("payment_id", input.paymentId).eq("status", "opened");
  if ((existing ?? []).length > 0) return { ok: false, message: "An open dispute already exists for this payment." };

  const { data: dispute } = await db.from("disputes").insert({
    gym_id: input.gymId,
    payment_id: input.paymentId,
    invoice_id: input.invoiceId ?? null,
    member_id: input.memberId,
    reason: input.reason,
    description: input.description,
    amount: input.amount,
    currency: input.currency ?? "INR",
    status: "opened",
    evidence_notes: input.evidenceNotes ?? null,
    opened_at: new Date().toISOString(),
  });

  if (!dispute) return { ok: false, message: "Failed to create dispute." };

  return { ok: true, message: "Dispute opened.", disputeId: dispute.id as string };
}

export async function updateDisputeStatus(
  disputeId: string,
  status: "under_review" | "won" | "lost" | "closed",
  responseNotes?: string | null
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const payload: Record<string, unknown> = { status };
  if (responseNotes !== undefined) payload.response_notes = responseNotes;
  if (status === "won" || status === "lost" || status === "closed") {
    payload.resolved_at = new Date().toISOString();
  }

  const { error } = await db.from("disputes").update(payload).eq("id", disputeId);
  if (error) return { ok: false, message: error.message };

  if (status === "won") {
    const { data: dispute } = await db.from("disputes").select("*").eq("id", disputeId).single();
    if (dispute) {
      await db.from("transactions").insert({
        gym_id: dispute.gym_id,
        member_id: dispute.member_id,
        transaction_type: "refund_processed",
        direction: "credit",
        amount: dispute.amount,
        currency: dispute.currency ?? "INR",
        description: `Dispute won — ${dispute.reason}`,
      });
    }
  }

  return { ok: true, message: `Dispute status updated to ${status}.` };
}

export async function getDisputeSummary(gymId: string): Promise<{
  open: number;
  underReview: number;
  won: number;
  lost: number;
  totalAmount: number;
}> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: all } = await db.from("disputes").select("*").in("gym_id", [gymId]);

  const rows = all ?? [];
  return {
    open: rows.filter((r) => (r.status as string) === "opened").length,
    underReview: rows.filter((r) => (r.status as string) === "under_review").length,
    won: rows.filter((r) => (r.status as string) === "won").length,
    lost: rows.filter((r) => (r.status as string) === "lost").length,
    totalAmount: rows.reduce((s: number, r: Record<string, unknown>) => s + ((r.amount as number) || 0), 0),
  };
}
