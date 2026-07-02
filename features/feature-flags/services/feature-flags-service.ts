import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type FeatureFlagRow = Database["public"]["Tables"]["feature_flags"]["Row"];
export type FeatureFlagInsert = Database["public"]["Tables"]["feature_flags"]["Insert"];
export type FeatureFlagUpdate = Database["public"]["Tables"]["feature_flags"]["Update"];
export type OrgFeatureFlagRow = Database["public"]["Tables"]["org_feature_flags"]["Row"];

export async function getFeatureFlags() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getFeatureFlag(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("feature_flags").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createFeatureFlag(input: FeatureFlagInsert) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("feature_flags").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateFeatureFlag(id: string, input: FeatureFlagUpdate) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("feature_flags").update(input).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteFeatureFlag(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("feature_flags").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getOrgFeatureFlags(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("org_feature_flags")
    .select("*, feature_flag:feature_flags(*)")
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setOrgFeatureFlag(organizationId: string, featureFlagId: string, enabled: boolean) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("org_feature_flags").upsert({
    organization_id: organizationId,
    feature_flag_id: featureFlagId,
    enabled,
  }, { onConflict: "organization_id,feature_flag_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function isFeatureEnabled(organizationId: string, featureKey: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data: flag } = await supabase.from("feature_flags").select("*").eq("key", featureKey).single();
  if (!flag) return false;
  if (flag.status !== "active") return false;
  if (flag.requires_plan) {
    const { data: org } = await supabase.from("organizations").select("plan_tier").eq("id", organizationId).single();
    if (org && org.plan_tier !== flag.requires_plan && org.plan_tier !== "enterprise") return false;
  }
  const { data: orgFlag } = await supabase.from("org_feature_flags").select("*")
    .eq("organization_id", organizationId).eq("feature_flag_id", flag.id).single();
  if (orgFlag) return orgFlag.enabled;
  return flag.default_enabled;
}
