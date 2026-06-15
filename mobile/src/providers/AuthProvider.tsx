import React, { useEffect } from "react";
import { useAuthStore } from "@/state/auth/auth-store";
import { networkMonitor } from "@/offline/network-monitor";
import { syncEngine } from "@/offline/sync-engine";
import { registerBackgroundSync } from "@/offline/background-sync";
import { LoadingState } from "@/components/ui/LoadingState";

const INIT_TIMEOUT_MS = 8000;

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    console.log("[AuthProvider] Starting initialization...");

    const timeoutId = setTimeout(() => {
      const state = useAuthStore.getState();
      if (!state.isInitialized) {
        console.warn("[AuthProvider] Initialization timed out after 8s. Forcing complete.");
        useAuthStore.setState({
          isInitialized: true,
          isLoading: false,
          error: "Initialization timed out. Redirecting to login.",
        });
      }
    }, INIT_TIMEOUT_MS);

    initialize().then(() => {
      console.log("[AuthProvider] Initialization complete.");
    }).catch((err) => {
      console.error("[AuthProvider] Initialization error:", err);
      useAuthStore.setState({
        isInitialized: true,
        isLoading: false,
        error: err instanceof Error ? err.message : "Initialization failed",
      });
    });

    networkMonitor.start();
    registerBackgroundSync();

    return () => {
      clearTimeout(timeoutId);
      networkMonitor.stop();
    };
  }, []);

  useEffect(() => {
    if (isInitialized) {
      console.log("[AuthProvider] Restoring offline queue...");
      syncEngine.restoreQueue().catch(() => {});
    }
  }, [isInitialized]);

  if (isLoading) {
    console.log("[AuthProvider] Showing loading state...");
  }

  if (!isInitialized || isLoading) {
    return <LoadingState fullScreen message="Loading..." />;
  }

  return <>{children}</>;
}
