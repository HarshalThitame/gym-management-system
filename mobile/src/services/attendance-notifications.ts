import { getSupabaseClient } from "@/api/supabase";

export const attendanceNotifications = {
  async sendCheckInConfirmation(memberId: string, gymId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();

      const { data: member } = await supabase
        .from("members")
        .select("user_id, full_name")
        .eq("id", memberId)
        .maybeSingle();

      if (!member?.user_id) return;

      await supabase.from("notifications").insert({
        user_id: member.user_id,
        title: "Check-In Successful",
        body: `Welcome ${member.full_name}! You've checked in successfully.`,
        type: "attendance",
        priority: "normal",
      });

      const { data: gymAdmins } = await supabase
        .from("branch_users")
        .select("user_id")
        .eq("gym_id", gymId)
        .eq("role_name", "gym_admin")
        .eq("status", "active");

      if (gymAdmins) {
        await supabase.from("notifications").insert(
          gymAdmins.map((admin) => ({
            user_id: admin.user_id,
            title: "Member Check-In",
            body: `${member.full_name} has checked in.`,
            type: "attendance",
            priority: "low",
          }))
        );
      }
    } catch {
      // Non-critical
    }
  },

  async sendCheckOutConfirmation(memberId: string, sessionId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();

      const { data: member } = await supabase
        .from("members")
        .select("user_id, full_name")
        .eq("id", memberId)
        .maybeSingle();

      if (!member?.user_id) return;

      const { data: session } = await supabase
        .from("attendance_sessions")
        .select("check_in_at, check_out_at")
        .eq("id", sessionId)
        .maybeSingle();

      const duration = session
        ? Math.round(
            (new Date(session.check_out_at ?? new Date()).getTime() - new Date(session.check_in_at).getTime()) / 60000
          )
        : 0;

      await supabase.from("notifications").insert({
        user_id: member.user_id,
        title: "Session Complete",
        body: `Great workout! Duration: ${duration} minutes.`,
        type: "attendance",
        priority: "normal",
      });
    } catch {
      // Non-critical
    }
  },

  async sendMissedVisitAlert(memberId: string, daysSinceLastVisit: number): Promise<void> {
    try {
      const supabase = getSupabaseClient();

      const { data: member } = await supabase
        .from("members")
        .select("user_id, full_name")
        .eq("id", memberId)
        .maybeSingle();

      if (!member?.user_id) return;

      await supabase.from("notifications").insert({
        user_id: member.user_id,
        title: "We Miss You!",
        body: `It's been ${daysSinceLastVisit} days since your last visit. Come back and stay on track!`,
        type: "attendance",
        priority: "high",
      });
    } catch {
      // Non-critical
    }
  },

  async sendAttendanceMilestone(memberId: string, milestone: string, streak: number): Promise<void> {
    try {
      const supabase = getSupabaseClient();

      const { data: member } = await supabase
        .from("members")
        .select("user_id, full_name")
        .eq("id", memberId)
        .maybeSingle();

      if (!member?.user_id) return;

      await supabase.from("notifications").insert({
        user_id: member.user_id,
        title: `🎉 Attendance Milestone: ${milestone}`,
        body: `Amazing! You've reached a ${streak}-day attendance streak! Keep it up!`,
        type: "attendance",
        priority: "high",
      });
    } catch {
      // Non-critical
    }
  },

  async checkAndNotifyMissedVisits(): Promise<number> {
    try {
      const supabase = getSupabaseClient();
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const { data: inactiveMembers } = await supabase
        .from("members")
        .select("id, user_id, full_name")
        .eq("status", "active")
        .not("user_id", "is", null);

      if (!inactiveMembers) return 0;

      let notified = 0;
      for (const member of inactiveMembers) {
        const { data: lastVisit } = await supabase
          .from("attendance_sessions")
          .select("check_in_at")
          .eq("member_id", member.id)
          .order("check_in_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lastVisit) continue;

        const daysSince = Math.round(
          (Date.now() - new Date(lastVisit.check_in_at).getTime()) / 86400000
        );

        if (daysSince >= 7) {
          await this.sendMissedVisitAlert(member.id, daysSince);
          notified++;
        }
      }

      return notified;
    } catch {
      return 0;
    }
  },
};
