"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { entitlementActionCatch, requireOrganizationFeatureAccess } from "@/features/entitlement";

export async function saveBrandingAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/branding");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "custom_branding", actionName: "branding.save" });
    const supabase = await createSupabaseServerClient();
    const configId = formData.get("configId") as string | null;
    const brandName = formData.get("brandName") as string;
    const tenantKey = normalizeTenantKey(formData.get("tenantKey"));
    const customDomain = normalizeOptionalText(formData.get("customDomain"));
    const logoUrl = normalizeOptionalText(formData.get("logoUrl"));
    const faviconUrl = normalizeOptionalText(formData.get("faviconUrl"));
    const status = normalizeBrandStatus(formData.get("status"));
    if (!brandName) return { ...prevState, status: "error", message: "Brand name is required." };
    if (!tenantKey) return { ...prevState, status: "error", message: "Tenant key is required." };

    const emailFromName = (formData.get("emailFromName") as string) || null;
    const emailReplyTo = (formData.get("emailReplyTo") as string) || null;
    const emailLogoUrl = (formData.get("emailLogoUrl") as string) || null;

    if (configId) {
      const { data: existing } = await supabase
        .from("tenant_configs")
        .select("email_branding")
        .eq("id", configId)
        .eq("organization_id", ctx.organizationId)
        .maybeSingle();

      const currentEmailBranding = (existing?.email_branding ?? {}) as Record<string, unknown>;
      const emailBranding = {
        ...currentEmailBranding,
        ...(emailFromName !== null ? { fromName: emailFromName } : {}),
        ...(emailReplyTo !== null ? { replyTo: emailReplyTo } : {}),
        ...(emailLogoUrl !== null ? { logoUrl: emailLogoUrl } : {}),
      };

      const update: Record<string, unknown> = {
        tenant_key: tenantKey,
        brand_name: brandName,
        custom_domain: customDomain,
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        status,
        primary_color: (formData.get("primaryColor") as string) || null || undefined,
        secondary_color: (formData.get("secondaryColor") as string) || null || undefined,
        accent_color: (formData.get("accentColor") as string) || null || undefined,
        email_branding: emailBranding,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from("tenant_configs").update(update as never).eq("id", configId).eq("organization_id", ctx.organizationId);
      if (error) throw new Error(error.message);
    } else {
      const emailBranding: Record<string, unknown> = {};
      if (emailFromName) emailBranding.fromName = emailFromName;
      if (emailReplyTo) emailBranding.replyTo = emailReplyTo;
      if (emailLogoUrl) emailBranding.logoUrl = emailLogoUrl;

      const insert: Record<string, unknown> = {
        organization_id: ctx.organizationId,
        tenant_key: tenantKey,
        brand_name: brandName,
        custom_domain: customDomain,
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        status,
        primary_color: (formData.get("primaryColor") as string) || null,
        secondary_color: (formData.get("secondaryColor") as string) || null,
        accent_color: (formData.get("accentColor") as string) || null,
        email_branding: Object.keys(emailBranding).length > 0 ? emailBranding : null,
        updated_by: ctx.userId
      };
      const { error } = await supabase.from("tenant_configs").insert(insert as never);
      if (error) throw new Error(error.message);
    }

    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_branding", entityType: "tenant_config", entityId: configId });
    revalidateOrgModules(["/organization/branding", "/organization/domains"]);
    return { ...prevState, status: "success", message: "Branding saved." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to save branding.");
  }
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeTenantKey(value: FormDataEntryValue | null) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeBrandStatus(value: FormDataEntryValue | null) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "draft" || normalized === "suspended" ? normalized : "active";
}
