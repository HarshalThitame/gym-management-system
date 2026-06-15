import { getSupabaseClient } from "@/api/supabase";

export interface CommAnalytics {
  totalSent: number; totalDelivered: number; totalFailed: number;
  byChannel: Record<string, number>; byType: Record<string, number>;
  openRate: number; clickRate: number;
  campaignsActive: number; campaignsCompleted: number;
  automationRules: number; templatesCount: number;
  announcementsActive: number;
}

export const commAnalyticsService = {
  async getAnalytics(orgId: string): Promise<CommAnalytics> {
    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split("T")[0];

    const [sent, failed, byChan, byType, campaigns, templates, announcements, rules] = await Promise.all([
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", today),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", today).eq("status", "failed"),
      supabase.from("notifications").select("type").eq("organization_id", orgId).gte("created_at", today),
      supabase.from("notifications").select("type").eq("organization_id", orgId).gte("created_at", today),
      supabase.from("comm_campaigns").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "sending"),
      supabase.from("comm_campaigns").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "completed"),
      supabase.from("comm_templates").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("announcements").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "published"),
      supabase.from("comm_automation_rules").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    ]);

    const channelMap: Record<string, number> = {};
    for (const n of (byChan.data ?? []) as any[]) { channelMap[n.type] = (channelMap[n.type] ?? 0) + 1; }

    return {
      totalSent: sent.count ?? 0, totalDelivered: (sent.count ?? 0) - (failed.count ?? 0), totalFailed: failed.count ?? 0,
      byChannel: channelMap, byType: channelMap,
      openRate: 0, clickRate: 0,
      campaignsActive: campaigns.count ?? 0, campaignsCompleted: campaigns.count ?? 0,
      automationRules: rules.count ?? 0, templatesCount: templates.count ?? 0,
      announcementsActive: announcements.count ?? 0,
    };
  },
};
