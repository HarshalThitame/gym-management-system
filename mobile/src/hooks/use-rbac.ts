import { useMemo } from "react";
import { useAuthStore } from "@/state/auth/auth-store";
import { useRBAC as useRBACBase } from "@/rbac/hooks";

export function useRBAC() {
  const user = useAuthStore((s) => s.user);
  return useRBACBase(user);
}

export { usePermissionGuard, useRoleGuard } from "@/rbac/hooks";
export type { RBACHookResult } from "@/rbac/hooks";
