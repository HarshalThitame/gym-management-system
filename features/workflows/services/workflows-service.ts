import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { Json } from "@/types/database";

export type WorkflowRow = Database["public"]["Tables"]["workflows"]["Row"];
export type WorkflowInsert = Database["public"]["Tables"]["workflows"]["Insert"];
export type WorkflowUpdate = Database["public"]["Tables"]["workflows"]["Update"];
export type WorkflowRunRow = Database["public"]["Tables"]["workflow_runs"]["Row"];
export type WorkflowStep = {
  id: string;
  type: "condition" | "action" | "delay" | "webhook";
  label: string;
  config: Record<string, unknown>;
  next_on_true?: string;
  next_on_false?: string;
};

export async function getWorkflows(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workflows")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWorkflow(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("workflows").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createWorkflow(input: WorkflowInsert) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("workflows").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateWorkflow(id: string, input: WorkflowUpdate) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("workflows").update(input).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteWorkflow(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("workflows").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function toggleWorkflowStatus(id: string, status: "active" | "inactive") {
  return updateWorkflow(id, { status } as WorkflowUpdate);
}

export async function getWorkflowRuns(workflowId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getExecutionLogs(runId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workflow_execution_logs")
    .select("*")
    .eq("workflow_run_id", runId)
    .order("step_index", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
