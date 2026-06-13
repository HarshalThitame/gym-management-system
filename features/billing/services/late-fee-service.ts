import type { DbClient } from "./db-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";


function getDb(supabase: unknown): DbClient { return supabase as never as DbClient; }

export type LateFeeResult = {
  invoiceId: string;
  daysOverdue: number;
  lateFee: number;
  policyApplied: string;
};

export async function calculateLateFee(invoice: Record<string, unknown>, policies: Array<Record<string, unknown>>): Promise<LateFeeResult | null> {
  const invoiceId = invoice.id as string;
  const dueAt = invoice.due_at as string | null;
  const totalAmount = (invoice.total_amount as number) || 0;

  if (!dueAt || totalAmount <= 0) return null;

  const dueDate = new Date(dueAt);
  const now = new Date();
  const daysOverdue = Math.max(0, Math.round((now.getTime() - dueDate.getTime()) / 86400000));

  if (daysOverdue <= 0) return null;

  for (const policy of policies) {
    const graceDays = (policy.grace_period_days as number) ?? 0;
    const feeType = policy.fee_type as string;
    const feeAmount = (policy.fee_amount as number) ?? 0;
    const feePercent = parseFloat((policy.fee_percent as string) ?? "0");
    const maxFee = policy.max_fee_amount as number | null;
    const recurrence = policy.recurrence as string;
    const appliesTo = policy.applies_to as string[] ?? [];

    if (!appliesTo.includes("invoice")) continue;

    const effectiveDaysOverdue = Math.max(0, daysOverdue - graceDays);
    if (effectiveDaysOverdue <= 0) continue;

    let lateFee = 0;

    if (feeType === "flat") {
      lateFee = feeAmount * (recurrence === "daily" ? effectiveDaysOverdue : 1);
    } else if (feeType === "percentage") {
      lateFee = Math.round((totalAmount * feePercent) / 100) * (recurrence === "daily" ? effectiveDaysOverdue : 1);
    } else if (feeType === "flat_after_grace") {
      lateFee = feeAmount;
    } else if (feeType === "percentage_after_grace") {
      lateFee = Math.round((totalAmount * feePercent) / 100);
    }

    if (maxFee) lateFee = Math.min(lateFee, maxFee);

    if (lateFee > 0) {
      return {
        invoiceId,
        daysOverdue,
        lateFee,
        policyApplied: `${policy.name as string} (${feeType})`,
      };
    }
  }

  return null;
}

export async function applyLateFeesToOverdueInvoices(): Promise<{ applied: number; errors: string[] }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: allPolicies } = await db.from("late_fee_policies").select("*").limit(1000);
  const activePolicies = (allPolicies ?? []).filter((p) => p.is_active as boolean);

  if (activePolicies.length === 0) return { applied: 0, errors: [] };

  const { data: overdueInvoices } = await db.from("org_subscription_invoices").select("*").limit(1000);
  const overdue = (overdueInvoices ?? []).filter((inv) => {
    const dueAt = inv.due_at as string | null;
    const status = inv.status as string;
    if (!dueAt || status === "paid" || status === "cancelled") return false;
    return new Date(dueAt) < new Date();
  });

  let applied = 0;
  const errors: string[] = [];

  for (const inv of overdue) {
    try {
      const result = await calculateLateFee(inv, activePolicies);
      if (result && result.lateFee > 0) {
        const currentTax = (inv.tax_amount as number) ?? 0;
        await db.from("org_subscription_invoices").update({
          tax_amount: currentTax + result.lateFee,
        }).eq("id", inv.id as string);
        applied++;
      }
    } catch (err) {
      errors.push(`Invoice ${inv.id as string}: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return { applied, errors };
}
