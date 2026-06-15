import React, { useEffect, useRef, useCallback } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AppProviders } from "@/providers/AppProviders";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isReady = useRef(false);

  const onReady = useCallback(async () => {
    if (isReady.current) return;
    isReady.current = true;
    try {
      await SplashScreen.hideAsync();
      console.log("[RootLayout] Splash screen hidden");
    } catch (e) {
      console.warn("[RootLayout] Splash hide error:", e);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isReady.current) {
        onReady();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [onReady]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  return (
    <AppProviders>
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 200,
          }}
        >
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="member" options={{ headerShown: false }} />
          <Stack.Screen name="trainer" options={{ headerShown: false }} />
          <Stack.Screen name="reception" options={{ headerShown: false }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
          <Stack.Screen name="owner" options={{ headerShown: false }} />
        </Stack>
      </View>
    </AppProviders>
  );
}
