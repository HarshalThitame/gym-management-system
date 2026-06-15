import React, { useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/state/auth/auth-store";
import { getRoleRedirect } from "@/rbac/permissions";

const NAV_TIMEOUT_MS = 12000;

export default function IndexScreen() {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    if (!isInitialized) return;

    hasRedirected.current = true;

    if (!isAuthenticated || !user) {
      console.log("[Index] No session → login");
      router.replace("/auth/login");
    } else {
      const redirect = getRoleRedirect(user.roles);
      console.log(`[Index] Session → ${redirect}`);
      router.replace(redirect as never);
    }
  }, [isInitialized]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasRedirected.current) {
        console.warn("[Index] Timeout → login");
        hasRedirected.current = true;
        router.replace("/auth/login");
      }
    }, NAV_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#070809" }}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={{ color: "#8b8d92", marginTop: 16, fontSize: 14 }}>
        {isInitialized ? "Starting..." : "Loading..."}
      </Text>
      {!isInitialized && (
        <TouchableOpacity onPress={() => { hasRedirected.current = true; router.replace("/auth/login"); }}
          style={{ marginTop: 24, padding: 12 }}>
          <Text style={{ color: "#FF6B35", fontSize: 14 }}>Skip to Login</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
