import React, { useEffect } from "react";
import { Stack, Tabs } from "expo-router";
import { router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useRBAC } from "@/hooks/use-rbac";
import { 
  Gauge, UsersRound, Calendar, Dumbbell, 
  MessageSquare, TrendingUp, ClipboardList,
} from "lucide-react-native";

function TrainerTabs() {
  const { theme } = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: theme.colors.bgSurface, borderTopColor: theme.colors.border, borderTopWidth: 1, paddingTop: 6, paddingBottom: 8, height: 60 },
      tabBarActiveTintColor: theme.colors.primary, tabBarInactiveTintColor: theme.colors.fgMuted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
    }}>
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Gauge size={size} color={color} /> }} />
      <Tabs.Screen name="members" options={{ title: "Members", tabBarIcon: ({ color, size }) => <UsersRound size={size} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule", tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} /> }} />
      <Tabs.Screen name="programs" options={{ title: "Programs", tabBarIcon: ({ color, size }) => <Dumbbell size={size} color={color} /> }} />
      <Tabs.Screen name="communications" options={{ title: "Chat", tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} /> }} />
    </Tabs>
  );
}

export default function TrainerLayout() {
  const { theme } = useTheme();
  const { isAuthenticated } = useRBAC();
  useEffect(() => { if (!isAuthenticated) router.replace("/auth/login"); }, [isAuthenticated]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: theme.colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="members" />
      <Stack.Screen name="members/[id]" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="programs" />
      <Stack.Screen name="programs/[id]" />
      <Stack.Screen name="programs/add" />
      <Stack.Screen name="progress" />
      <Stack.Screen name="progress/[id]" />
      <Stack.Screen name="exercises" />
      <Stack.Screen name="assessments" />
      <Stack.Screen name="communications" />
      <Stack.Screen name="reports" />
    </Stack>
  );
}
