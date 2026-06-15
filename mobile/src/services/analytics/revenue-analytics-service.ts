import { getSupabaseClient } from "@/api/supabase";

function getEmptyRevenueAnalytics(): RevenueAnalytics {
  return { daily: [], weekly: [], monthly: [], byMethod: {}, byType: {}, byPlan: {}, totalMonth: 0, totalYear: 0, growth: 0, forecast: 0 };
}

export interface RevenueAnalytics {
  daily: { date: string; amount: number }[];
  weekly: { week: string; amount: number }[];
  monthly: { month: string; amount: number }[];
  byMethod: Record<string, number>;
  byType: Record<string, number>;
  byPlan: Record<string, number>;
  totalMonth: number;
  totalYear: number;
  growth: number;
  forecast: number;
}

export const revenueAnalyticsService = {
  async getRevenueAnalytics(orgId: string, months = 12): Promise<RevenueAnalytics> {
    try {
    const supabase = getSupabaseClient();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const start = startDate.toISOString();

    const { data: payments } = await supabase
      .from("payments")
      .select("amount, payment_method, payment_type, paid_at, created_at, gym_id")
      .eq("organization_id", orgId)
      .eq("status", "paid")
      .gte("paid_at", start)
      .order("paid_at");

    const records = (payments ?? []) as any[];
    const daily: Record<string, number> = {};
    const weekly: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const p of records) {
      const date = new Date(p.paid_at ?? p.created_at);
      const dayKey = date.toISOString().split("T")[0];
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];
      const amt = p.amount ?? 0;

      daily[dayKey] = (daily[dayKey] ?? 0) + amt;
      weekly[weekKey] = (weekly[weekKey] ?? 0) + amt;
      monthly[monthKey] = (monthly[monthKey] ?? 0) + amt;
      byMethod[p.payment_method] = (byMethod[p.payment_method] ?? 0) + amt;
      byType[p.payment_type] = (byType[p.payment_type] ?? 0) + amt;
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
    const totalMonth = monthly[currentMonth] ?? 0;
    const totalLastMonth = monthly[lastMonthKey] ?? 0;
    const totalYear = Object.entries(monthly)
      .filter(([k]) => k.startsWith(String(now.getFullYear())))
      .reduce((s, [, v]) => s + v, 0);
    const growth = totalLastMonth > 0 ? Math.round(((totalMonth - totalLastMonth) / totalLastMonth) * 100) : 0;
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const forecast = daysElapsed > 0 ? Math.round((totalMonth / daysElapsed) * daysInMonth) : 0;

    return {
      daily: Object.entries(daily).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)),
      weekly: Object.entries(weekly).map(([week, amount]) => ({ week, amount })),
      monthly: Object.entries(monthly).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month)),
      byMethod, byType, byPlan: {},
      totalMonth, totalYear, growth, forecast,
    };
    } catch { return getEmptyRevenueAnalytics(); }
  },
};
