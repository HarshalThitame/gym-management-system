import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

export type RevenueFilters = {
  dateFrom: string;
  dateTo: string;
  gymId: string;
  status: string;
  page: number;
  pageSize: number;
};

export type RevenueSummary = {
  totalCollected: number;
  totalPending: number;
  totalFailed: number;
  totalRefunded: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
};

export type RevenueManagementData = {
  payments: PaymentRow[];
  summary: RevenueSummary;
  total: number;
  totalPages: number;
};

export async function getRevenueData(organizationId: string, filters: RevenueFilters): Promise<RevenueManagementData> {
  const supabase = await createSupabaseServerClient();

  const gymIdsResult = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = (gymIdsResult.data ?? []).map((g) => g.id);

  if (gymIds.length === 0) {
    return {
      payments: [],
      summary: { totalCollected: 0, totalPending: 0, totalFailed: 0, totalRefunded: 0, paidCount: 0, pendingCount: 0, failedCount: 0, refundedCount: 0 },
      total: 0,
      totalPages: 0
    };
  }

  const targetGymIds = filters.gymId !== "all" ? [filters.gymId] : gymIds;

  let query = supabase
    .from("payments")
    .select("*", { count: "exact" })
    .in("gym_id", targetGymIds);

  if (filters.status !== "all") {
    query = query.eq("status", filters.status as "paid" | "pending" | "failed" | "refunded" | "cancelled" | "processing" | "partially_refunded");
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const { data: payments, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + filters.pageSize - 1);

  if (error) throw new Error(error.message);

  const { data: allPayments } = await supabase
    .from("payments")
    .select("amount, status")
    .in("gym_id", gymIds);

  const all = allPayments ?? [];
  const totalPages = count ? Math.ceil(count / filters.pageSize) : 0;

  const summary: RevenueSummary = {
    totalCollected: all.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0),
    totalPending: all.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount ?? 0), 0),
    totalFailed: all.filter((p) => p.status === "failed").reduce((s, p) => s + Number(p.amount ?? 0), 0),
    totalRefunded: all.filter((p) => p.status === "refunded").reduce((s, p) => s + Number(p.amount ?? 0), 0),
    paidCount: all.filter((p) => p.status === "paid").length,
    pendingCount: all.filter((p) => p.status === "pending").length,
    failedCount: all.filter((p) => p.status === "failed").length,
    refundedCount: all.filter((p) => p.status === "refunded").length
  };

  return {
    payments: payments ?? [],
    summary,
    total: count ?? 0,
    totalPages
  };
}
