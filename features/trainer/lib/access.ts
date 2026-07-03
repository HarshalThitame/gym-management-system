import { requirePortalFeatureAccess } from "@/features/entitlement/portal-gates";
import { requireRole } from "@/lib/auth/guards";

export async function requireTrainerPortalAccess(nextPath = "/trainer") {
  const context = await requireRole(["trainer"], nextPath);

  if (context.organizationId) {
    await requirePortalFeatureAccess({
      portal: "trainer",
      organizationId: context.organizationId,
      pathname: nextPath,
      actionName: `portal.trainer.${nextPath}`,
    });
  }

  return context;
}
