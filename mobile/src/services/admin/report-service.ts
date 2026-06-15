import { getSupabaseClient } from "@/api/supabase";

export interface RevenueReport {
  daily: number[];
  weekly: number[];
  monthly: number;
  byMethod: Record<string, number>;
  byType: Record<string, number>;
}

export interface MemberReport {
  total: number;
  active: number;
  newThisMonth: number;
  renewalsThisMonth: number;
  expiringThisMonth: number;
  byPlan: Record<string, number>;
}

export interface AttendanceReport {
  today: number;
  thisWeek: number;
  thisMonth: number;
  averageDaily: number;
  peakHour: number;
}

export const adminReportService = {
  async getRevenueReport(gymId: string): Promise<RevenueReport> {
    const supabase = getSupabaseClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: payments } = await supabase
      .from("payments")
      .select("amount, payment_method, payment_type, paid_at")
      .eq("gym_id", gymId)
      .eq("status", "paid")
      .gte("paid_at", monthStart);

    const records = (payments ?? []) as Array<{ amount: number; payment_method: string; payment_type: string; paid_at: string }>;
    const daily: number[] = new Array(now.getDate()).fill(0);
    const weekly: number[] = new Array(7).fill(0);
    const byMethod: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let monthly = 0;

    for (const p of records) {
      monthly += p.amount;
      const day = new Date(p.paid_at).getDate() - 1;
      if (day >= 0 && day < daily.length) daily[day] += p.amount;

      const dayOfWeek = new Date(p.paid_at).getDay();
      weekly[dayOfWeek] += p.amount;

      byMethod[p.payment_method] = (byMethod[p.payment_method] ?? 0) + p.amount;
      byType[p.payment_type] = (byType[p.payment_type] ?? 0) + p.amount;
    }

    return { daily, weekly, monthly, byMethod, byType };
  },

  async getMemberReport(gymId: string): Promise<MemberReport> {
    const supabase = getSupabaseClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const [total, active, newThisMonth, renewals, expiring, plans] = await Promise.all([
      supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "active"),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", gymId).gte("joined_at", monthStart),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "active").gte("start_date", monthStart),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "active").lte("end_date", monthEnd),
      supabase.from("memberships").select("plan_id").eq("gym_id", gymId).eq("status", "active"),
    ]);

    const byPlan: Record<string, number> = {};
    const planIds = (plans.data ?? []) as Array<{ plan_id: string }>;
    for (const m of planIds) {
      byPlan[m.plan_id] = (byPlan[m.plan_id] ?? 0) + 1;
    }

    return {
      total: total.count ?? 0,
      active: active.count ?? 0,
      newThisMonth: newThisMonth.count ?? 0,
      renewalsThisMonth: renewals.count ?? 0,
      expiringThisMonth: expiring.count ?? 0,
      byPlan,
    };
  },

  async getAttendanceReport(gymId: string): Promise<AttendanceReport> {
    const supabase = getSupabaseClient();
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const [todayS, weekS, monthS] = await Promise.all([
      supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("gym_id", gymId).gte("check_in_at", today),
      supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("gym_id", gymId).gte("check_in_at", weekStart),
      supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("gym_id", gymId).gte("check_in_at", monthStart).lte("check_in_at", monthEnd),
    ]);

    const daysElapsed = now.getDate();
    return {
      today: todayS.count ?? 0,
      thisWeek: weekS.count ?? 0,
      thisMonth: monthS.count ?? 0,
      averageDaily: daysElapsed > 0 ? Math.round((monthS.count ?? 0) / daysElapsed) : 0,
      peakHour: 17,
    };
  },
};
