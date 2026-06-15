import { useCallback, useEffect, useRef } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/state/auth/auth-store";
import { getRoleRedirect } from "@/rbac/permissions";
import { startSessionMonitor, stopSessionMonitor } from "@/authentication/session";

export function useAuth() {
  const store = useAuthStore();
  const sessionMonitorRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (store.isAuthenticated) {
      sessionMonitorRef.current = startSessionMonitor(() => {
        store.logout();
        router.replace("/auth/login");
      });
    }

    return () => {
      if (sessionMonitorRef.current) {
        sessionMonitorRef.current();
        sessionMonitorRef.current = null;
      }
    };
  }, [store.isAuthenticated]);

  const redirectToRoleDashboard = useCallback(() => {
    if (!store.user) return "/auth/login";

    const redirect = getRoleRedirect(store.user.roles);
    router.replace(redirect as never);
    return redirect;
  }, [store.user]);

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    isInitialized: store.isInitialized,
    error: store.error,
    primaryRole: store.user?.primaryRole ?? null,
    roles: store.user?.roles ?? [],
    organizationId: store.user?.organizationId ?? null,
    profile: store.user?.profile ?? null,
    login: store.login,
    register: store.register,
    logout: store.logout,
    refreshSession: store.refreshSession,
    redirectToRoleDashboard,
    clearError: store.clearError,
  };
}
