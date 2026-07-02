import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type IntegrationRow = Database["public"]["Tables"]["integrations"]["Row"];
export type IntegrationInsert = Database["public"]["Tables"]["integrations"]["Insert"];
export type IntegrationUpdate = Database["public"]["Tables"]["integrations"]["Update"];

export async function getIntegrations(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function connectIntegration(input: IntegrationInsert) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("integrations").upsert(input, {
    onConflict: "organization_id,provider",
    ignoreDuplicates: false,
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function disconnectIntegration(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("integrations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateIntegrationConfig(id: string, config: Record<string, unknown>, credentials?: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const update: IntegrationUpdate = { config } as IntegrationUpdate;
  if (credentials) update.credentials = credentials as Database["public"]["Tables"]["integrations"]["Update"]["credentials"];
  const { data, error } = await supabase.from("integrations").update(update).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getIntegrationLogs(integrationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("integration_logs")
    .select("*")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}
