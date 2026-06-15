import { getSupabaseClient } from "@/api/supabase";

export interface FinancialAnalytics {
  collected: number; pending: number; overdue: number; refunded: number;
  discountUsage: number; membershipRevenue: number; ptRevenue: number; classRevenue: number;
  leakageRisk: number; projectedRevenue: number;
}

export const financialAnalyticsService = {
  async getFinancialAnalytics(orgId: string): Promise<FinancialAnalytics> {
    try {
    const supabase = getSupabaseClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [collected, pending, overdue, refunded, byType] = await Promise.all([
      supabase.from("payments").select("amount").eq("organization_id", orgId).eq("status", "paid").gte("created_at", monthStart),
      supabase.from("payments").select("amount").eq("organization_id", orgId).in("status", ["pending", "processing"]),
      supabase.from("invoices").select("due_amount").eq("organization_id", orgId).eq("status", "overdue"),
      supabase.from("payments").select("amount").eq("organization_id", orgId).eq("status", "refunded").gte("created_at", monthStart),
      supabase.from("payments").select("amount, payment_type").eq("organization_id", orgId).eq("status", "paid").gte("created_at", monthStart),
    ]);

    const collectedAmt = (collected.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
    const pendingAmt = (pending.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
    const overdueAmt = (overdue.data ?? []).reduce((s: number, r: any) => s + (r.due_amount ?? 0), 0);
    const refundedAmt = (refunded.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);

    const typeData = (byType.data ?? []) as any[];
    const membershipRevenue = typeData.filter((r: any) => r.payment_type?.includes("membership")).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
    const ptRevenue = typeData.filter((r: any) => r.payment_type === "personal_training").reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
    const classRevenue = typeData.filter((r: any) => r.payment_type === "class_fee").reduce((s: number, r: any) => s + (r.amount ?? 0), 0);

    return {
      collected: collectedAmt,
      pending: pendingAmt,
      overdue: overdueAmt,
      refunded: refundedAmt,
      discountUsage: 0,
      membershipRevenue,
      ptRevenue,
      classRevenue,
      leakageRisk: collectedAmt > 0 ? Math.round((overdueAmt / collectedAmt) * 100) : 0,
      projectedRevenue: collectedAmt + pendingAmt,
    };
    } catch { return { collected: 0, pending: 0, overdue: 0, refunded: 0, discountUsage: 0, membershipRevenue: 0, ptRevenue: 0, classRevenue: 0, leakageRisk: 0, projectedRevenue: 0 }; }
  },
};
