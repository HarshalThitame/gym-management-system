import { getSupabaseClient } from "@/api/supabase";

export type AttendanceAuditAction =
  | "check_in"
  | "check_out"
  | "auto_check_out"
  | "manual_override"
  | "correction"
  | "qr_validation"
  | "qr_validation_failed";

export const attendanceAudit = {
  async log(params: {
    action: AttendanceAuditAction;
    memberId: string;
    gymId: string;
    sessionId?: string;
    performedBy?: string;
    method?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase.from("attendance_audit_log").insert({
        organization_id: params.metadata?.organizationId as string ?? null,
        gym_id: params.gymId,
        member_id: params.memberId,
        session_id: params.sessionId ?? null,
        action: params.action,
        performed_by: params.performedBy ?? null,
        method: params.method ?? null,
        metadata: params.metadata ?? {},
        ip_address: null,
        user_agent: "mobile-app",
        created_at: new Date().toISOString(),
      });

      if (error) console.error("Audit log error:", error.message);
    } catch {
      // Non-critical
    }
  },

  async getSessionAuditTrail(sessionId: string) {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("attendance_audit_log")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      return data ?? [];
    } catch {
      return [];
    }
  },

  async getMemberAuditTrail(memberId: string, limit = 50) {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("attendance_audit_log")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return data ?? [];
    } catch {
      return [];
    }
  },

  async getGymAuditTrail(gymId: string, limit = 100) {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("attendance_audit_log")
        .select("*")
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return data ?? [];
    } catch {
      return [];
    }
  },
};
