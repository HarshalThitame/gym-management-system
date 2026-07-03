import { requirePortalFeatureAccess } from "@/features/entitlement/portal-gates";
import { requirePrimaryRole } from "@/lib/auth/guards";

export async function requireMemberPortalAccess(nextPath = "/member") {
  const context = await requirePrimaryRole(["member"], nextPath);

  if (context.organizationId) {
    await requirePortalFeatureAccess({
      portal: "member",
      organizationId: context.organizationId,
      pathname: nextPath,
      actionName: `portal.member.${nextPath}`,
    });
  }

  return context;
}
