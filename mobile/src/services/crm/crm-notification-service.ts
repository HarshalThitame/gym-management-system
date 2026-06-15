import { getSupabaseClient } from "@/api/supabase";

export const crmNotificationService = {
  async sendFollowUpReminder(followUpId: string, userId: string, leadName: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Follow-Up Reminder",
        body: `Follow-up with ${leadName} is due`,
        type: "lead",
        priority: "high",
      });
    } catch {}
  },

  async sendLeadAssignment(leadId: string, assignedUserId: string, leadName: string, assignedByName: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      await supabase.from("notifications").insert({
        user_id: assignedUserId,
        title: "Lead Assigned",
        body: `${assignedByName} assigned lead "${leadName}" to you`,
        type: "lead",
        priority: "high",
      });
    } catch {}
  },

  async sendTrialReminder(trialId: string, userId: string, leadName: string, scheduledAt: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Trial Reminder",
        body: `Trial session with ${leadName} at ${new Date(scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
        type: "lead",
        priority: "high",
      });
    } catch {}
  },

  async sendConversionAlert(leadName: string, memberCode: string, gymId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { data: admins } = await supabase.from("branch_users").select("user_id").eq("gym_id", gymId).in("role_name", ["gym_admin", "organization_owner"]);
      if (admins) {
        await supabase.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.user_id,
            title: "New Member Converted",
            body: `${leadName} converted to member (${memberCode})`,
            type: "lead",
            priority: "normal",
          }))
        );
      }
    } catch {}
  },

  async sendLeadInactivityAlert(leadId: string, userId: string, leadName: string, daysSinceContact: number): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Lead Inactive",
        body: `${leadName} hasn't been contacted in ${daysSinceContact} days`,
        type: "lead",
        priority: "low",
      });
    } catch {}
  },
};
