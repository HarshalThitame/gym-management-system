import React, { useEffect } from "react";
import { Stack, Tabs } from "expo-router";
import { router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useRBAC } from "@/hooks/use-rbac";
import { 
  Gauge, UsersRound, CreditCard, CalendarCheck, 
  Settings, Dumbbell, UserPlus, BarChart3,
  Megaphone, CalendarDays, MessageSquare,
} from "lucide-react-native";

function AdminTabs() {
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
      <Tabs.Screen name="payments" options={{ title: "Payments", tabBarIcon: ({ color, size }) => <CreditCard size={size} color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} /> }} />
      <Tabs.Screen name="trainers" options={{ title: "Trainers", tabBarIcon: ({ color, size }) => <Dumbbell size={size} color={color} /> }} />
    </Tabs>
  );
}

export default function AdminLayout() {
  const { theme } = useTheme();
  const { isAuthenticated } = useRBAC();
  useEffect(() => { if (!isAuthenticated) router.replace("/auth/login"); }, [isAuthenticated]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: theme.colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="members" />
      <Stack.Screen name="members/add" />
      <Stack.Screen name="members/[id]" />
      <Stack.Screen name="trainers" />
      <Stack.Screen name="trainers/[id]" />
      <Stack.Screen name="staff" />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="membership-plans" />
      <Stack.Screen name="leads" />
      <Stack.Screen name="leads/[id]" />
      <Stack.Screen name="leads/add" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="classes" />
      <Stack.Screen name="communications" />
      <Stack.Screen name="announcements" />
      <Stack.Screen name="fitness" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="crm-dashboard" />
      <Stack.Screen name="trials" />
      <Stack.Screen name="trials/[id]" />
      <Stack.Screen name="followups" />
      <Stack.Screen name="analytics/revenue" />
      <Stack.Screen name="analytics/membership" />
      <Stack.Screen name="analytics/attendance" />
      <Stack.Screen name="analytics/trainers" />
    </Stack>
  );
}
