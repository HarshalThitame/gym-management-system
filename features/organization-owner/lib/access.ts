import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import type { ScopedOrganizationOwnerContext } from "../services/organization-owner-service";

export async function requireOrganizationOwner(nextPath = "/organization"): Promise<ScopedOrganizationOwnerContext> {
  const context = await requireRole(["organization_owner"], nextPath);

  if (!context.organizationId) {
    redirect("/unauthorized?reason=organization_scope");
  }

  return context as ScopedOrganizationOwnerContext;
}
