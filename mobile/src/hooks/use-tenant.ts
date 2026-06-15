import { useCallback, useEffect } from "react";
import { useTenantStore } from "@/state/tenant/tenant-store";
import { useAuthStore } from "@/state/auth/auth-store";
import {
  resolveTenantByOrganizationId,
  createTenantContext,
  canAccessTenant,
} from "@/tenant/service";
import type { TenantContext } from "@/tenant/service";

export function useTenant() {
  const store = useTenantStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user?.organizationId && !store.tenant.resolved) {
      resolveTenantByOrganizationId(user.organizationId).then((resolution) => {
        const context = createTenantContext(resolution, user?.profile?.full_name ?? null);
        store.setTenant(context);
      }).catch(() => {
        // Fallback to default tenant context
      });
    }
  }, [user?.organizationId]);

  const checkAccess = useCallback(
    (targetOrgId: string | null, targetGymId: string | null): boolean => {
      return canAccessTenant(
        user?.organizationId ?? null,
        user?.profile?.gym_id ?? null,
        user?.roles ?? [],
        targetOrgId,
        targetGymId
      );
    },
    [user]
  );

  return {
    tenant: store.tenant,
    brandName: store.tenant.brand.name,
    brandShortName: store.tenant.brand.shortName,
    brandInitial: store.tenant.brand.initial,
    primaryColor: store.tenant.brand.primaryColor,
    logoUrl: store.tenant.brand.logoUrl,
    planTier: store.tenant.planTier,
    resolved: store.tenant.resolved,
    organizationId: store.tenant.organizationId,
    gymId: store.tenant.gymId,
    branchId: store.tenant.branchId,
    checkAccess,
  };
}
