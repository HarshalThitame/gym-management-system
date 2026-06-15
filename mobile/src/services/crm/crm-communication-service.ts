import { getSupabaseClient } from "@/api/supabase";

export type CommChannel = "call" | "whatsapp" | "email" | "sms" | "meeting";

export interface CommRecord {
  id: string;
  lead_id: string;
  channel: CommChannel;
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string | null;
  duration_seconds: number | null;
  created_by: string | null;
  created_at: string;
}

export const crmCommunicationService = {
  async logCommunication(data: {
    lead_id: string;
    channel: CommChannel;
    direction: "inbound" | "outbound";
    subject?: string;
    body?: string;
    duration_seconds?: number;
  }): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("lead_communications").insert({
        lead_id: data.lead_id,
        channel: data.channel,
        direction: data.direction,
        subject: data.subject ?? null,
        body: data.body ?? null,
        duration_seconds: data.duration_seconds ?? null,
        created_at: new Date().toISOString(),
      });
      if (error) return false;

      await supabase.from("leads").update({ last_contacted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", data.lead_id);
      return true;
    } catch { return false; }
  },

  async getLeadCommunications(leadId: string): Promise<CommRecord[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("lead_communications").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
      return (data ?? []) as CommRecord[];
    } catch { return []; }
  },

  async getRecentCommunications(gymId: string, limit = 20): Promise<(CommRecord & { leads?: { name: string } })[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("lead_communications").select("*, leads!inner(name, gym_id)").eq("leads.gym_id", gymId).order("created_at", { ascending: false }).limit(limit);
      return (data ?? []) as (CommRecord & { leads?: { name: string } })[];
    } catch { return []; }
  },
};
