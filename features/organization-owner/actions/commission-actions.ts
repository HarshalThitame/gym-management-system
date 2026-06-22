"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrgFeatureAccess, entitlementActionCatch } from "@/features/entitlement";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";

type TrainerCommissionRow = Database["public"]["Tables"]["trainer_commissions"]["Row"];
type TrainerCommissionRateRow = Database["public"]["Tables"]["trainer_commission_rates"]["Row"];
type TrainerRow = Database["public"]["Tables"]["trainers"]["Row"];

export type CommissionRow = Omit<TrainerCommissionRow, "trainers"> & {
  trainer_name: string | undefined;
};

export type CommissionRateRow = Omit<TrainerCommissionRateRow, "trainers"> & {
  trainer_name: string | undefined;
};

export type CommissionFilters = {
  trainerId: string | undefined;
  status: string | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  page: number | undefined;
  pageSize: number | undefined;
};

export type CommissionResult = {
  commissions: CommissionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalPending: number;
    totalPaid: number;
    totalAmount: number;
  };
};

export async function getTrainerCommissions(
  organizationId: string,
  filters: CommissionFilters = { trainerId: undefined, status: undefined, dateFrom: undefined, dateTo: undefined, page: undefined, pageSize: undefined }
): Promise<CommissionResult> {
  await requireOrgFeatureAccess(organizationId, "trainer_commissions_payroll");

  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters.pageSize ?? 12));

  let q = supabase
    .from("trainer_commissions")
    .select("*, trainers!trainer_commissions_trainer_id_fkey(display_name)", { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters.trainerId) q = q.eq("trainer_id", filters.trainerId);
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status as TrainerCommissionRow["status"]);
  if (filters.dateFrom) q = q.gte("calculated_at", filters.dateFrom);
  if (filters.dateTo) q = q.lte("calculated_at", filters.dateTo);

  const { data, count } = await q
    .order("calculated_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const commissions: CommissionRow[] = (data ?? []).map((row) => ({
    ...row,
    trainer_name: (row as unknown as { trainers: TrainerRow | TrainerRow[] | null }).trainers
      ? ((Array.isArray((row as unknown as { trainers: TrainerRow | TrainerRow[] }).trainers)
          ? (row as unknown as { trainers: TrainerRow[] }).trainers[0]
          : (row as unknown as { trainers: TrainerRow }).trainers)?.display_name ?? undefined)
      : undefined,
  }));

  const { data: aggData } = await supabase
    .from("trainer_commissions")
    .select("status, amount")
    .eq("organization_id", organizationId);

  const agg = aggData ?? [];
  const summary = {
    totalPending: agg.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0),
    totalPaid: agg.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0),
    totalAmount: agg.reduce((s, r) => s + r.amount, 0),
  };

  return { commissions, total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize), summary };
}

export async function getCommissionRates(organizationId: string): Promise<CommissionRateRow[]> {
  await requireOrgFeatureAccess(organizationId, "trainer_commissions_payroll");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("trainer_commission_rates")
    .select("*, trainers!trainer_commission_rates_trainer_id_fkey(display_name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    ...row,
    trainer_name: (row as unknown as { trainers: TrainerRow | TrainerRow[] | null }).trainers
      ? ((Array.isArray((row as unknown as { trainers: TrainerRow | TrainerRow[] }).trainers)
          ? (row as unknown as { trainers: TrainerRow[] }).trainers[0]
          : (row as unknown as { trainers: TrainerRow }).trainers)?.display_name ?? undefined)
      : undefined,
  }));
}

export async function setCommissionRate(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/trainers");
    await requireOrgFeatureAccess(ctx.organizationId, "trainer_commissions_payroll");

    const trainerId = formData.get("trainerId") as string;
    const sourceType = formData.get("sourceType") as string;
    const rate = Number(formData.get("rate"));

    if (!trainerId || !sourceType || isNaN(rate) || rate < 0 || rate > 100) {
      return { ...prevState, status: "error", message: "Invalid rate data. Rate must be 0-100." };
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("trainer_commission_rates").upsert({
      organization_id: ctx.organizationId,
      trainer_id: trainerId,
      source_type: sourceType as TrainerCommissionRateRow["source_type"],
      rate,
      is_active: true,
    }, { onConflict: "organization_id,trainer_id,source_type" });

    if (error) throw new Error(error.message);

    revalidateOrgModules(["/organization/trainers"]);
    return { ...prevState, status: "success", message: "Commission rate updated." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to set commission rate.");
  }
}

export async function markCommissionPaid(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/trainers");
    await requireOrgFeatureAccess(ctx.organizationId, "trainer_commissions_payroll");

    const commissionId = formData.get("commissionId") as string;
    if (!commissionId) return { ...prevState, status: "error", message: "Commission ID required." };

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("trainer_commissions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", commissionId)
      .eq("organization_id", ctx.organizationId);

    if (error) throw new Error(error.message);

    revalidateOrgModules(["/organization/trainers"]);
    return { ...prevState, status: "success", message: "Commission marked as paid." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to mark commission as paid.");
  }
}

export async function cancelCommission(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/trainers");
    await requireOrgFeatureAccess(ctx.organizationId, "trainer_commissions_payroll");

    const commissionId = formData.get("commissionId") as string;
    if (!commissionId) return { ...prevState, status: "error", message: "Commission ID required." };

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("trainer_commissions")
      .update({ status: "cancelled" })
      .eq("id", commissionId)
      .eq("organization_id", ctx.organizationId);

    if (error) throw new Error(error.message);

    revalidateOrgModules(["/organization/trainers"]);
    return { ...prevState, status: "success", message: "Commission cancelled." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to cancel commission.");
  }
}

export async function getDefaultCommissionRates(organizationId: string): Promise<CommissionRateRow[]> {
  await requireOrgFeatureAccess(organizationId, "trainer_commissions_payroll");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("trainer_commission_rates")
    .select("*")
    .eq("organization_id", organizationId)
    .is("trainer_id", null)
    .order("source_type", { ascending: true });

  return (data ?? []) as CommissionRateRow[];
}

export async function setDefaultCommissionRate(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/trainers");
    await requireOrgFeatureAccess(ctx.organizationId, "trainer_commissions_payroll");

    const sourceType = formData.get("sourceType") as string;
    const rate = Number(formData.get("rate"));

    if (!sourceType || isNaN(rate) || rate < 0 || rate > 100) {
      return { ...prevState, status: "error", message: "Invalid rate data. Rate must be 0-100." };
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("trainer_commission_rates").upsert({
      organization_id: ctx.organizationId,
      trainer_id: null,
      source_type: sourceType as TrainerCommissionRateRow["source_type"],
      rate,
      is_active: true,
    }, { onConflict: "organization_id,source_type" });

    if (error) throw new Error(error.message);

    revalidateOrgModules(["/organization/trainers"]);
    return { ...prevState, status: "success", message: "Default rate updated." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to set default rate.");
  }
}

/**
 * Called internally when a PT session completes or class attendance is marked.
 * Calculates commission using trainer-specific rate first, falling back to org-wide default.
 */
export async function calculateCommissionsForSession(
  organizationId: string,
  trainerId: string,
  sourceType: "pt_session" | "class",
  sourceId: string,
  description: string,
  baseAmount: number
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();

    // First try trainer-specific rate
    let { data: rateRow } = await supabase
      .from("trainer_commission_rates")
      .select("rate")
      .eq("organization_id", organizationId)
      .eq("trainer_id", trainerId)
      .eq("source_type", sourceType)
      .eq("is_active", true)
      .maybeSingle();

    // Fall back to org-wide default rate
    if (!rateRow) {
      const { data: defaultRow } = await supabase
        .from("trainer_commission_rates")
        .select("rate")
        .eq("organization_id", organizationId)
        .is("trainer_id", null)
        .eq("source_type", sourceType)
        .eq("is_active", true)
        .maybeSingle();
      rateRow = defaultRow;
    }

    const rate = rateRow?.rate ?? 0;
    if (rate <= 0) return;

    const commissionAmount = Math.round((baseAmount * rate) / 100);

    await supabase.from("trainer_commissions").insert({
      organization_id: organizationId,
      trainer_id: trainerId,
      source_type: sourceType,
      source_id: sourceId,
      description,
      amount: commissionAmount,
      rate,
    });
  } catch {
    // Silently fail — don't block the parent operation
  }
}
