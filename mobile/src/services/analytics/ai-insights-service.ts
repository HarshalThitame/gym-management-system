import { getSupabaseClient } from "@/api/supabase";

export interface BusinessInsight {
  type: "positive" | "negative" | "warning" | "info";
  category: "revenue" | "membership" | "attendance" | "crm" | "trainer" | "branch" | "financial";
  title: string;
  description: string;
  recommendation: string;
  metric: string;
  change: number;
}

export const aiInsightsService = {
  async generateInsights(orgId: string): Promise<BusinessInsight[]> {
    try {
    const insights: BusinessInsight[] = [];
    const supabase = getSupabaseClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    const [revenueThis, revenueLast, membersThis, membersLast, attendanceThis, attendanceLast] = await Promise.all([
      supabase.from("payments").select("amount").eq("organization_id", orgId).eq("status", "paid").gte("created_at", monthStart),
      supabase.from("payments").select("amount").eq("organization_id", orgId).eq("status", "paid").gte("created_at", lastMonthStart).lte("created_at", lastMonthEnd),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("joined_at", monthStart),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("joined_at", lastMonthStart).lte("joined_at", lastMonthEnd),
      supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("check_in_at", monthStart),
      supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("check_in_at", lastMonthStart).lte("check_in_at", lastMonthEnd),
    ]);

    const revThis = (revenueThis.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
    const revLast = (revenueLast.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
    const memThis = membersThis.count ?? 0;
    const memLast = membersLast.count ?? 0;
    const attThis = attendanceThis.count ?? 0;
    const attLast = attendanceLast.count ?? 0;

    // Revenue insight
    if (revLast > 0) {
      const revChange = Math.round(((revThis - revLast) / revLast) * 100);
      insights.push({
        type: revChange >= 0 ? "positive" : "negative",
        category: "revenue",
        title: revChange >= 0 ? "Revenue Growing" : "Revenue Declining",
        description: `Revenue ${revChange >= 0 ? "increased" : "decreased"} by ${Math.abs(revChange)}% compared to last month.`,
        recommendation: revChange < 0 ? "Review membership pricing, check for churn patterns, and increase lead generation." : "Continue current growth strategies. Consider expansion.",
        metric: "₹" + revThis.toLocaleString(),
        change: revChange,
      });
    }

    // Member growth insight
    if (memLast > 0 || memThis > 0) {
      const memChange = memLast > 0 ? Math.round(((memThis - memLast) / memLast) * 100) : 100;
      insights.push({
        type: memChange >= 0 ? "positive" : "negative",
        category: "membership",
        title: memChange >= 0 ? "Member Growth" : "Member Decline",
        description: `${memThis} new members this month (${memChange >= 0 ? "+" : ""}${memChange}% vs last month).`,
        recommendation: memChange < 0 ? "Increase referral programs and reactivate inactive members." : "Maintain acquisition channels.",
        metric: String(memThis),
        change: memChange,
      });
    }

    // Attendance insight
    if (attLast > 0) {
      const attChange = Math.round(((attThis - attLast) / attLast) * 100);
      insights.push({
        type: attChange >= 0 ? "info" : "warning",
        category: "attendance",
        title: attChange >= 0 ? "Attendance Stable" : "Attendance Dropping",
        description: `Attendance ${attChange >= 0 ? "increased" : "decreased"} by ${Math.abs(attChange)}% this month.`,
        recommendation: attChange < 0 ? "Launch engagement campaigns, check trainer schedules, review class offerings." : "Keep current programming.",
        metric: `${attThis} visits`,
        change: attChange,
      });
    }

    // Churn risk check
    const { data: expiring } = await supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active").lte("end_date", new Date(Date.now() + 30 * 86400000).toISOString());
    if ((expiring.count ?? 0) > 5) {
      insights.push({
        type: "warning", category: "membership",
        title: "Renewal Risk",
        description: `${expiring.count} memberships expiring within 30 days.`,
        recommendation: "Start renewal campaigns. Offer early renewal discounts.",
        metric: `${expiring.count} at risk`,
        change: -expiring.count ?? 0,
      });
    }

    return insights;
    } catch { return []; }
  },
};
