"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { entitlementActionCatch, requireOrganizationFeatureAccess } from "@/features/entitlement";

type DomainInsert = Database["public"]["Tables"]["tenant_domains"]["Insert"];

export async function addDomainAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/domains");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "custom_domain", actionName: "domain.add" });

    const supabase = await createSupabaseServerClient();
    const domain = formData.get("domain") as string;
    if (!domain) return { ...prevState, status: "error", message: "Domain is required." };

    const { data: existing } = await supabase.from("tenant_domains").select("id").eq("domain", domain).maybeSingle();
    if (existing) return { ...prevState, status: "error", message: "Domain already exists." };

    const domainType = (formData.get("domainType") as string) || "custom_domain";
    const routingMode = (formData.get("routingMode") as string) || "organization";

    const insert: Record<string, unknown> = {
      organization_id: ctx.organizationId,
      domain,
      domain_type: domainType,
      routing_mode: routingMode,
      status: "pending",
      is_primary: false
    };
    const { data, error } = await supabase.from("tenant_domains").insert(insert as never).select("id").single();
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.add_domain", entityType: "tenant_domain", entityId: data.id, metadata: { domain } as never });
    revalidateOrgModules(["/organization/domains"]);
    return { ...prevState, status: "success", message: "Domain added. Complete DNS verification." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to add domain.");
  }
}

export async function removeDomainAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/domains");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "custom_domain", actionName: "domain.remove" });
    const domainId = formData.get("domainId") as string;
    if (!domainId) return { ...prevState, status: "error", message: "Domain ID is required." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("tenant_domains").update({ status: "disabled" } as never).eq("id", domainId).eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.remove_domain", entityType: "tenant_domain", entityId: domainId });
    revalidateOrgModules(["/organization/domains"]);
    return { ...prevState, status: "success", message: "Domain removed." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to remove domain.");
  }
}
