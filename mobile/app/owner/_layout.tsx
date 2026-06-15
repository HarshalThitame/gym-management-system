import React, { useEffect } from "react";
import { Stack, Tabs } from "expo-router";
import { router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useRBAC } from "@/hooks/use-rbac";
import { 
  Gauge, Building2, MapPin, Users, Dumbbell, 
  CreditCard, BarChart3, Settings, Bell, Palette,
  FileText, Megaphone, ScrollText, MessageSquare,
  TrendingUp, Target, Activity, Brain,
} from "lucide-react-native";

function OwnerTabs() {
  const { theme } = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: theme.colors.bgSurface, borderTopColor: theme.colors.border, borderTopWidth: 1, paddingTop: 6, paddingBottom: 8, height: 60 },
      tabBarActiveTintColor: theme.colors.primary, tabBarInactiveTintColor: theme.colors.fgMuted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
    }}>
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Gauge size={size} color={color} /> }} />
      <Tabs.Screen name="gyms" options={{ title: "Gyms", tabBarIcon: ({ color, size }) => <Building2 size={size} color={color} /> }} />
      <Tabs.Screen name="staff" options={{ title: "Staff", tabBarIcon: ({ color, size }) => <Users size={size} color={color} /> }} />
      <Tabs.Screen name="billing" options={{ title: "Billing", tabBarIcon: ({ color, size }) => <CreditCard size={size} color={color} /> }} />
      <Tabs.Screen name="reports" options={{ title: "Reports", tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} /> }} />
      <Tabs.Screen name="crm" options={{ title: "CRM", tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} /> }} />
    </Tabs>
  );
}

export default function OwnerLayout() {
  const { theme } = useTheme();
  const { isAuthenticated } = useRBAC();
  useEffect(() => { if (!isAuthenticated) router.replace("/auth/login"); }, [isAuthenticated]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: theme.colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="gyms" />
      <Stack.Screen name="gyms/[id]" />
      <Stack.Screen name="branches" />
      <Stack.Screen name="branches/[id]" />
      <Stack.Screen name="staff" />
      <Stack.Screen name="staff/[id]" />
      <Stack.Screen name="trainers" />
      <Stack.Screen name="billing" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="branding" />
      <Stack.Screen name="audit-logs" />
      <Stack.Screen name="announcements" />
      <Stack.Screen name="communications" />
      <Stack.Screen name="crm" />
      <Stack.Screen name="analytics/revenue" />
      <Stack.Screen name="analytics/membership" />
      <Stack.Screen name="analytics/attendance" />
      <Stack.Screen name="analytics/branches" />
      <Stack.Screen name="analytics/trainers" />
      <Stack.Screen name="analytics/financial" />
      <Stack.Screen name="analytics/subscription" />
      <Stack.Screen name="analytics/insights" />
      <Stack.Screen name="analytics/gyms" />
    </Stack>
  );
}
