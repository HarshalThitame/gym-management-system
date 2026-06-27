import { createSupabaseServerClient } from "@/lib/supabase/server";
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

export async function getDefaultCommissionRates(organizationId: string): Promise<CommissionRateRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("trainer_commission_rates")
    .select("*")
    .eq("organization_id", organizationId)
    .is("trainer_id", null)
    .order("source_type", { ascending: true });

  return (data ?? []) as CommissionRateRow[];
}

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

    let { data: rateRow } = await supabase
      .from("trainer_commission_rates")
      .select("rate")
      .eq("organization_id", organizationId)
      .eq("trainer_id", trainerId)
      .eq("source_type", sourceType)
      .eq("is_active", true)
      .maybeSingle();

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
