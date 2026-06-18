"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { entitlementActionCatch, requireOrganizationFeatureAccess } from "@/features/entitlement";

type ConfigInsert = Database["public"]["Tables"]["tenant_configs"]["Insert"];
type ConfigUpdate = Database["public"]["Tables"]["tenant_configs"]["Update"];

export async function saveBrandingAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/branding");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "custom_branding", actionName: "branding.save" });
    const supabase = await createSupabaseServerClient();
    const configId = formData.get("configId") as string | null;
    const brandName = formData.get("brandName") as string;
    if (!brandName) return { ...prevState, status: "error", message: "Brand name is required." };

    if (configId) {
      const update: Record<string, unknown> = {
        brand_name: brandName,
        primary_color: (formData.get("primaryColor") as string) || null || undefined,
        secondary_color: (formData.get("secondaryColor") as string) || null || undefined,
        accent_color: (formData.get("accentColor") as string) || null || undefined,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from("tenant_configs").update(update as never).eq("id", configId).eq("organization_id", ctx.organizationId);
      if (error) throw new Error(error.message);
    } else {
      const insert: Record<string, unknown> = {
        organization_id: ctx.organizationId,
        tenant_key: `org-${ctx.organizationId.slice(0, 8)}`,
        brand_name: brandName,
        primary_color: (formData.get("primaryColor") as string) || null,
        secondary_color: (formData.get("secondaryColor") as string) || null,
        accent_color: (formData.get("accentColor") as string) || null,
        status: "active"
      };
      const { error } = await supabase.from("tenant_configs").insert(insert as never);
      if (error) throw new Error(error.message);
    }

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_branding", entityType: "tenant_config", entityId: configId });
    revalidateOrgModules(["/organization/branding"]);
    return { ...prevState, status: "success", message: "Branding saved." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to save branding.");
  }
}
