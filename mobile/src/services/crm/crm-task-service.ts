import { getSupabaseClient } from "@/api/supabase";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface CRMTask {
  id: string;
  organization_id: string;
  gym_id: string;
  lead_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export const crmTaskService = {
  async createTask(data: {
    organization_id: string;
    gym_id: string;
    lead_id?: string;
    title: string;
    description?: string;
    priority?: TaskPriority;
    assigned_to?: string;
    due_at?: string;
  }): Promise<{ ok: boolean; error?: string; id?: string }> {
    try {
      const supabase = getSupabaseClient();
      const { data: result, error } = await supabase.from("crm_tasks").insert({
        organization_id: data.organization_id,
        gym_id: data.gym_id,
        lead_id: data.lead_id ?? null,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority ?? "medium",
        status: "pending",
        assigned_to: data.assigned_to ?? null,
        due_at: data.due_at ?? null,
      }).select("id").maybeSingle();

      if (error) return { ok: false, error: error.message };
      return { ok: true, id: result?.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Failed to create task" };
    }
  },

  async completeTask(taskId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("crm_tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", taskId);
      return !error;
    } catch { return false; }
  },

  async getTasksForUser(userId: string): Promise<CRMTask[]> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("crm_tasks").select("*").eq("assigned_to", userId).order("due_at", { ascending: true });
      return (data ?? []) as CRMTask[];
    } catch { return []; }
  },

  async getTodaysTasks(userId: string): Promise<CRMTask[]> {
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const { data } = await supabase.from("crm_tasks").select("*").eq("assigned_to", userId).eq("status", "pending").gte("due_at", today).lt("due_at", tomorrow).order("due_at");
      return (data ?? []) as CRMTask[];
    } catch { return []; }
  },

  async getOverdueTasks(userId: string): Promise<CRMTask[]> {
    try {
      const supabase = getSupabaseClient();
      const now = new Date().toISOString();
      const { data } = await supabase.from("crm_tasks").select("*").eq("assigned_to", userId).eq("status", "pending").lt("due_at", now).order("due_at");
      return (data ?? []) as CRMTask[];
    } catch { return []; }
  },
};
