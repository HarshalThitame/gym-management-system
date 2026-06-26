"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

export async function saveTenantConfigAction(configId: string, data: Record<string, unknown>) {
  await requireRole(["super_admin"], "/super-admin/white-label");

  const update: Database["public"]["Tables"]["tenant_configs"]["Update"] = {
    brand_name: data.brand_name as string,
    organization_id: data.organization_id as string,
    status: (data.status as string) ?? "active",
    plan_tier: (data.plan_tier as string) ?? "free",
    tenant_key: data.tenant_key as string,
    logo_url: (data.logo_url as string) || null,
    favicon_url: (data.favicon_url as string) || null,
    custom_domain: (data.custom_domain as string) || null,
    primary_color: ((data.brand_colors as Record<string, string>)?.primary) ?? "",
    secondary_color: ((data.brand_colors as Record<string, string>)?.secondary) ?? "",
    accent_color: ((data.brand_colors as Record<string, string>)?.accent) ?? "",
    typography: (data.typography ?? {}) as unknown as Json,
    email_branding: {
      fromName: String(data.email_from_name ?? ""),
      replyTo: String(data.email_reply_to ?? ""),
    } as unknown as Json,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tenant_configs").update(update).eq("id", configId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorId: "super_admin",
    action: "super_admin.update_tenant_branding",
    entityType: "tenant_config",
    entityId: configId,
  });

  revalidatePath("/super-admin/white-label");
  return { success: true };
}
