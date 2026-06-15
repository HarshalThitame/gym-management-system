import React, { useEffect } from "react";
import { Stack, Tabs } from "expo-router";
import { router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useRBAC } from "@/hooks/use-rbac";
import { Gauge, Dumbbell, CalendarCheck, TrendingUp, UserRound } from "lucide-react-native";

function MemberTabs() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.bgSurface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.fgMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Gauge size={size} color={color} /> }} />
      <Tabs.Screen name="workouts" options={{ title: "Workouts", tabBarIcon: ({ color, size }) => <Dumbbell size={size} color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} /> }} />
      <Tabs.Screen name="progress" options={{ title: "Progress", tabBarIcon: ({ color, size }) => <TrendingUp size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <UserRound size={size} color={color} /> }} />
    </Tabs>
  );
}

export default function MemberLayout() {
  const { theme } = useTheme();
  const { isAuthenticated } = useRBAC();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [isAuthenticated]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="workouts" />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="progress" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="membership/index" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="membership/history" />
      <Stack.Screen name="attendance/qr" options={{ animation: "fade" }} />
      <Stack.Screen name="attendance/scanner" options={{ animation: "fade" }} />
      <Stack.Screen name="attendance/history" />
      <Stack.Screen name="workouts/[id]" />
      <Stack.Screen name="workouts/log" />
      <Stack.Screen name="diet/index" />
      <Stack.Screen name="diet/[id]" />
      <Stack.Screen name="diet/meal-log" />
      <Stack.Screen name="billing/index" />
      <Stack.Screen name="billing/invoice/[id]" />
      <Stack.Screen name="notifications/index" />
      <Stack.Screen name="trainer/index" />
      <Stack.Screen name="referrals/index" />
      <Stack.Screen name="offers/index" />
      <Stack.Screen name="branches/index" />
      <Stack.Screen name="settings/index" />
    </Stack>
  );
}
