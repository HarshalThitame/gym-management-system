import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";

const superAdminRoles = ["super_admin"] as const;

export type DomainTransferInput = {
  domainId: string;
  targetOrganizationId: string;
  reason?: string;
};

export async function transferDomainAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return { ok: false, message: "Super Admin access required." };

  const parsed = input as DomainTransferInput;
  if (!parsed.domainId || !parsed.targetOrganizationId) {
    return { ok: false, message: "domainId and targetOrganizationId are required." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: domain } = await supabase.from("tenant_domains").select("*").eq("id", parsed.domainId).single();
    if (!domain) return { ok: false, message: "Domain not found." };

    const d = domain as unknown as { organization_id: string; domain: string };
    const sourceOrgId = d.organization_id;

    if (sourceOrgId === parsed.targetOrganizationId) {
      return { ok: false, message: "Domain is already assigned to this organization." };
    }

    const { data: targetOrg } = await supabase.from("organizations").select("id, name").eq("id", parsed.targetOrganizationId).single();
    if (!targetOrg) return { ok: false, message: "Target organization not found." };

    const { error: updateError } = await supabase
      .from("tenant_domains")
      .update({ organization_id: parsed.targetOrganizationId, tenant_config_id: null })
      .eq("id", parsed.domainId);

    if (updateError) return { ok: false, message: updateError.message };

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "domain.transferred",
      entityType: "tenant_domain",
      entityId: parsed.domainId,
      metadata: {
        sourceOrganizationId: sourceOrgId,
        targetOrganizationId: parsed.targetOrganizationId,
        reason: parsed.reason ?? null,
      },
    });

    return { ok: true, message: `Domain transferred to ${(targetOrg as unknown as { name: string }).name}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Transfer failed." };
  }
}
