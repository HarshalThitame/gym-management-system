"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess, entitlementActionCatch } from "@/features/entitlement";

type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];
type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"];

export async function saveCampaignAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/communications");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "whatsapp_integration", actionName: "campaign.save" });
    const supabase = await createSupabaseServerClient();
    const campaignId = formData.get("campaignId") as string | null;
    const gymId = formData.get("gymId") as string;
    const name = formData.get("name") as string;
    const campaignType = formData.get("campaignType") as string;
    if (!gymId || !name || !campaignType) return { ...prevState, status: "error", message: "Gym, name, and campaign type are required." };

    const { data: gym } = await supabase.from("gyms").select("organization_id").eq("id", gymId).single();
    if (!gym || gym.organization_id !== ctx.organizationId) return { ...prevState, status: "error", message: "Gym not in your organization." };

    const category = (formData.get("category") as string) || "membership";
    const segmentKey = (formData.get("segmentKey") as string) || "all";
    const scheduledFor = (formData.get("scheduledFor") as string) || null;

    if (campaignId) {
      const update: Record<string, unknown> = { name, campaign_type: campaignType, category, segment_key: segmentKey, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("campaigns").update(update as never).eq("id", campaignId);
      if (error) throw new Error(error.message);
    } else {
      const insert: Record<string, unknown> = { gym_id: gymId, name, campaign_type: campaignType, category, segment_key: segmentKey, status: scheduledFor ? "scheduled" : "draft", scheduled_for: scheduledFor };
      const { data, error } = await supabase.from("campaigns").insert(insert as never).select("id").single();
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_campaign", entityType: "campaign", entityId: data.id });
    }

    revalidateOrgModules(["/organization/communications"]);
    return { ...prevState, status: "success", message: "Campaign saved." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to save campaign.");
  }
}

export async function sendCampaignAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/communications");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "whatsapp_integration", actionName: "campaign.send" });
    const campaignId = formData.get("campaignId") as string;
    if (!campaignId) return { ...prevState, status: "error", message: "Campaign ID is required." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("campaigns").update({ status: "running", updated_at: new Date().toISOString() } as never).eq("id", campaignId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.send_campaign", entityType: "campaign", entityId: campaignId });
    revalidateOrgModules(["/organization/communications"]);
    return { ...prevState, status: "success", message: "Campaign sent." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to send campaign.");
  }
}
