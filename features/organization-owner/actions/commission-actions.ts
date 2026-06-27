"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrgFeatureAccess, entitlementActionCatch } from "@/features/entitlement";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import {
  getTrainerCommissions as getCommissions,
  getCommissionRates as getRates,
  getDefaultCommissionRates as getDefaults,
  calculateCommissionsForSession as calcCommissions,
} from "../services/commission-service";
import type {
  CommissionRow,
  CommissionRateRow,
  CommissionFilters,
  CommissionResult,
} from "../services/commission-service";

export type { CommissionRow, CommissionRateRow, CommissionFilters, CommissionResult };

type TrainerCommissionRateRow = Database["public"]["Tables"]["trainer_commission_rates"]["Row"];

export async function getTrainerCommissions(
  organizationId: string,
  filters: CommissionFilters = { trainerId: undefined, status: undefined, dateFrom: undefined, dateTo: undefined, page: undefined, pageSize: undefined }
): Promise<CommissionResult> {
  await requireOrgFeatureAccess(organizationId, "trainer_commissions_payroll");
  return getCommissions(organizationId, filters);
}

export async function getCommissionRates(organizationId: string): Promise<CommissionRateRow[]> {
  await requireOrgFeatureAccess(organizationId, "trainer_commissions_payroll");
  return getRates(organizationId);
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
  return getDefaults(organizationId);
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

export async function calculateCommissionsForSession(
  organizationId: string,
  trainerId: string,
  sourceType: "pt_session" | "class",
  sourceId: string,
  description: string,
  baseAmount: number
): Promise<void> {
  await requireOrgFeatureAccess(organizationId, "trainer_commissions_payroll");
  return calcCommissions(organizationId, trainerId, sourceType, sourceId, description, baseAmount);
}
