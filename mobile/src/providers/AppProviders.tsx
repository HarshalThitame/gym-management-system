import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { AuthProvider } from "./AuthProvider";
import { useTenant } from "@/hooks/use-tenant";
import { useAuthStore } from "@/state/auth/auth-store";

function AppContent({ children }: { children: React.ReactNode }) {
  const { primaryColor, secondaryColor, accentColor } = useTenant();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    try {
      import("@/lib/error-tracking").then(({ initializeErrorTracking, setUserContext }) => {
        try {
          initializeErrorTracking();
          setUserContext(user?.userId ?? null, user?.email ?? null);
        } catch {}
      }).catch(() => {});
    } catch {}
  }, [user?.userId, user?.email]);

  return (
    <ThemeProvider tenantColors={{ primaryColor, secondaryColor, accentColor }}>
      <StatusBar style="auto" />
      {children}
    </ThemeProvider>
  );
}

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppContent>{children}</AppContent>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
