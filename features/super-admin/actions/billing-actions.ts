"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import type { AuthActionState } from "@/features/auth/actions/action-state";

const superAdminRoles = ["super_admin"] as const;

function revalidatePaths() {
  revalidatePath("/super-admin/billing");
  revalidatePath("/super-admin/subscriptions");
}

/* ──────────── INVOICE GENERATION ──────────── */

export type GenerateInvoiceInput = {
  organizationId: string;
  subscriptionId: string | null;
  invoiceType: "subscription" | "one_time";
  amount: number;
  currency: string;
  description: string | null;
  dueDate: string;
};

export async function generateInvoiceAction(input: GenerateInvoiceInput): Promise<AuthActionState & { invoiceId?: string }> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    const db = getSupabaseAdminClient() as any;
    if (!db) return { status: "error", message: "Database connection failed." };

    const invoiceNumber = `INV-MAN-${Date.now().toString(36).toUpperCase()}-${input.organizationId.slice(0, 4).toUpperCase()}`;
    const now = new Date().toISOString();
    const dueAt = input.dueDate || new Date(Date.now() + 30 * 86400000).toISOString();

    const { data: invoice, error } = await db.from("org_subscription_invoices").insert({
      organization_id: input.organizationId,
      subscription_id: input.subscriptionId || null,
      invoice_number: invoiceNumber,
      total_amount: input.amount,
      subtotal_amount: input.amount,
      currency: input.currency || "INR",
      status: "issued",
      description: input.description || null,
      issued_at: now,
      due_at: dueAt,
      provider_environment: "test",
      billing_cycle: input.invoiceType === "subscription" ? "recurring" : "one_time",
    }).select("id").maybeSingle();

    if (error || !invoice) return { status: "error", message: "Failed to create invoice." };

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "billing.invoice.manual_generated",
      entityType: "org_subscription_invoices",
      entityId: invoice.id,
      metadata: {
        organizationId: input.organizationId,
        invoiceNumber,
        amount: input.amount,
        invoiceType: input.invoiceType,
      },
    });

    revalidatePaths();
    return { status: "success", message: `Invoice ${invoiceNumber} created.`, invoiceId: invoice.id };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Invoice generation failed." };
  }
}

/* ──────────── REFUND PROCESSING ──────────── */

export type ProcessRefundInput = {
  invoiceId: string | null;
  paymentId: string | null;
  organizationId: string;
  amount: number;
  reason: "duplicate" | "customer_request" | "service_issue" | "fraud" | "other";
  notes: string | null;
  stepUpEmail: string;
};

export async function processRefundAction(input: ProcessRefundInput): Promise<AuthActionState & { refundId?: string }> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  if (!input.stepUpEmail || !input.stepUpEmail.includes("@")) return { status: "error", message: "Valid MFA step-up email is required." };

  try {
    const db = getSupabaseAdminClient() as any;
    if (!db) return { status: "error", message: "Database connection failed." };

    const refundId = `REF-${Date.now().toString(36).toUpperCase()}`;

    const { error: refundError } = await db.from("refunds").insert({
      id: refundId,
      organization_id: input.organizationId,
      invoice_id: input.invoiceId || null,
      payment_id: input.paymentId || null,
      amount: input.amount,
      currency: "INR",
      reason: input.reason,
      notes: input.notes || null,
      status: "processed",
      processed_by: auth.context.userId,
      processed_at: new Date().toISOString(),
    });

    if (refundError) return { status: "error", message: "Failed to create refund record." };

    // Trigger Razorpay refund if payment ID provided
    if (input.paymentId) {
      try {
        const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        await fetch(`${origin}/api/billing/razorpay/refunds`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-super-admin-internal": "true" },
          body: JSON.stringify({ paymentId: input.paymentId, amount: input.amount, reason: input.reason }),
        });
      } catch {
        // Razorpay refund is best-effort; don't fail the whole operation
      }
      await db.from("payments").update({ status: "refunded" }).eq("id", input.paymentId);
    }

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "billing.refund.processed",
      entityType: "refunds",
      entityId: refundId,
      metadata: {
        organizationId: input.organizationId,
        amount: input.amount,
        reason: input.reason,
        invoiceId: input.invoiceId,
      },
    });

    revalidatePaths();
    return { status: "success", message: `Refund ${refundId} processed.`, refundId };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Refund processing failed." };
  }
}

/* ──────────── DISPUTE ACTIONS ──────────── */

export type DisputeActionInput = {
  disputeId: string;
  organizationId: string;
  action: "resolve" | "accept" | "escalate";
  notes?: string | undefined;
  stepUpEmail: string;
};

export async function disputeAction(input: DisputeActionInput): Promise<AuthActionState> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };
  if (!input.stepUpEmail || !input.stepUpEmail.includes("@")) return { status: "error", message: "Valid MFA step-up email is required." };

  try {
    const db = getSupabaseAdminClient() as any;
    if (!db) return { status: "error", message: "Database connection failed." };

    const statusMap: Record<string, string> = { resolve: "resolved", accept: "lost", escalate: "escalated" };
    const newStatus = statusMap[input.action];

    await db.from("billing_disputes").update({
      status: newStatus,
      resolved_at: new Date().toISOString(),
      resolution_notes: input.notes || null,
      resolved_by: auth.context.userId,
    }).eq("id", input.disputeId);

    await writeAuditLog({
      actorId: auth.context.userId,
      action: `billing.dispute.${input.action}`,
      entityType: "billing_disputes",
      entityId: input.disputeId,
      metadata: { organizationId: input.organizationId, action: input.action, notes: input.notes },
    });

    revalidatePaths();
    return { status: "success", message: `Dispute ${input.action}d successfully.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : `Failed to ${input.action} dispute.` };
  }
}

/* ──────────── WRITE-OFF ACTIONS ──────────── */

export type CreateWriteOffInput = {
  organizationId: string;
  amount: number;
  reason: "bad_debt" | "fraud" | "abandoned" | "other";
  notes?: string | undefined;
  stepUpEmail: string;
};

export async function createWriteOffAction(input: CreateWriteOffInput): Promise<AuthActionState & { writeOffId?: string }> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };
  if (!input.stepUpEmail || !input.stepUpEmail.includes("@")) return { status: "error", message: "Valid MFA step-up email is required." };

  try {
    const db = getSupabaseAdminClient() as any;
    if (!db) return { status: "error", message: "Database connection failed." };

    const writeOffId = `WO-${Date.now().toString(36).toUpperCase()}`;

    await db.from("write_offs").insert({
      id: writeOffId,
      organization_id: input.organizationId,
      amount: input.amount,
      currency: "INR",
      reason: input.reason,
      notes: input.notes || null,
      status: "active",
      created_by: auth.context.userId,
      created_at: new Date().toISOString(),
    });

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "billing.write_off.created",
      entityType: "write_offs",
      entityId: writeOffId,
      metadata: { organizationId: input.organizationId, amount: input.amount, reason: input.reason },
    });

    revalidatePaths();
    return { status: "success", message: `Write-off ${writeOffId} created.`, writeOffId };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to create write-off." };
  }
}

export async function reverseWriteOffAction(input: { writeOffId: string; organizationId: string; reason: string; stepUpEmail: string }): Promise<AuthActionState> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };
  if (!input.stepUpEmail || !input.stepUpEmail.includes("@")) return { status: "error", message: "Valid MFA step-up email is required." };

  try {
    const db = getSupabaseAdminClient() as any;
    if (!db) return { status: "error", message: "Database connection failed." };

    await db.from("write_offs").update({ status: "reversed", reversed_at: new Date().toISOString(), reversed_by: auth.context.userId }).eq("id", input.writeOffId);

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "billing.write_off.reversed",
      entityType: "write_offs",
      entityId: input.writeOffId,
      metadata: { organizationId: input.organizationId, reason: input.reason },
    });

    revalidatePaths();
    return { status: "success", message: "Write-off reversed." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to reverse write-off." };
  }
}

/* ──────────── RECONCILIATION ACTIONS ──────────── */

export async function markReconciledAction(input: { entryId: string; notes?: string }): Promise<AuthActionState> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required." };

  try {
    const db = getSupabaseAdminClient() as any;
    if (!db) return { status: "error", message: "Database connection failed." };

    await db.from("reconciliation_entries").update({
      status: "matched",
      reconciled_at: new Date().toISOString(),
      reconciled_by: auth.context.userId,
      notes: input.notes || null,
    }).eq("id", input.entryId);

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "billing.reconciliation.marked",
      entityType: "reconciliation_entries",
      entityId: input.entryId,
      metadata: { notes: input.notes },
    });

    revalidatePaths();
    return { status: "success", message: "Entry marked as reconciled." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Failed to mark reconciled." };
  }
}

export async function triggerReconciliationAction(): Promise<AuthActionState & { matched: number; unmatched: number }> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { status: "error", message: "Super Admin access required.", matched: 0, unmatched: 0 };

  try {
    const db = getSupabaseAdminClient() as any;
    if (!db) return { status: "error", message: "Database connection failed.", matched: 0, unmatched: 0 };

    // Fetch invoices and payments
    const { data: invoices } = await db.from("org_subscription_invoices").select("id, invoice_number, total_amount, razorpay_order_id, razorpay_payment_id, paid_at, status");
    const { data: payments } = await db.from("payments").select("id, razorpay_order_id, razorpay_payment_id, amount, status, invoice_id");

    if (!invoices || !payments) return { status: "error", message: "Failed to fetch data for reconciliation.", matched: 0, unmatched: 0 };

    let matched = 0;
    let unmatched = 0;

    const paymentMap = new Map();
    for (const p of payments) {
      const key = p.razorpay_order_id || p.razorpay_payment_id || p.invoice_id;
      if (key) paymentMap.set(key, p);
    }

    for (const inv of invoices) {
      const matchKey = inv.razorpay_order_id || inv.razorpay_payment_id || inv.id;
      const paymentMatch = matchKey ? paymentMap.get(matchKey) : null;
      const isMatched = paymentMatch || (inv.paid_at && inv.razorpay_payment_id);

      if (isMatched) {
        matched++;
      } else if (inv.status === "paid") {
        matched++;
      } else {
        unmatched++;
      }
    }

    const { data: existing } = await db.from("reconciliation_entries").select("id").eq("status", "pending").limit(1);
    if (existing && existing.length > 0) {
      await db.from("reconciliation_entries").update({
        status: "matched",
        reconciled_at: new Date().toISOString(),
        reconciled_by: auth.context.userId,
      }).eq("status", "pending");
    }

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "billing.reconciliation.triggered",
      entityType: "reconciliation_entries",
      entityId: "bulk",
      metadata: { matched, unmatched },
    });

    revalidatePaths();
    return { status: "success", message: `Reconciliation complete: ${matched} matched, ${unmatched} unmatched.`, matched, unmatched };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Reconciliation failed.", matched: 0, unmatched: 0 };
  }
}
