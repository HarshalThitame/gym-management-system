"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database, Json } from "@/types/database";
import { requireOrgFeatureAccess, entitlementActionCatch } from "@/features/entitlement";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";

export async function saveOrganizationProfileAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const context = await getOrgOwnerContext("/organization/profile");
    await requireOrgFeatureAccess(context.organizationId, "member_management");
    const supabase = await createSupabaseServerClient();
    const organizationId = context.organizationId;
    const name = formData.get("name") as string;
    if (!name) return { ...prevState, status: "error", message: "Organization name is required." };

    const { data: current } = await supabase.from("organizations").select("settings").eq("id", organizationId).single();
    const existingSettings = (current?.settings as Record<string, unknown>) ?? {};

    const update: Partial<Database["public"]["Tables"]["organizations"]["Update"]> = {
      name,
      primary_domain: (formData.get("primaryDomain") as string) || null,
      billing_email: (formData.get("billingEmail") as string) || null,
      settings: { ...existingSettings, legalName: formData.get("legalName"), gstNumber: formData.get("gstNumber"), phone: formData.get("phone"), address: formData.get("address") } as Json,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("organizations").update(update).eq("id", organizationId);
    if (error) throw new Error(error.message);

    await writeAuditLog({ actorId: context.userId, action: "organization_owner.update_profile", entityType: "organization", entityId: organizationId });
    revalidateOrgModules(["/organization/profile"]);
    return { ...prevState, status: "success", message: "Organization profile updated." };
  } catch (error) {
    return entitlementActionCatch(error) ?? { ...prevState, status: "error", message: error instanceof Error ? error.message : "Failed to update profile." };
  }
}
