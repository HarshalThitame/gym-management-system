import React, { useEffect } from "react";
import { Stack, Tabs } from "expo-router";
import { router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useRBAC } from "@/hooks/use-rbac";
import { 
  Gauge, CalendarCheck, UserRoundPlus, CreditCard, 
  MessageSquare, CalendarDays, Users,
} from "lucide-react-native";

function ReceptionTabs() {
  const { theme } = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: theme.colors.bgSurface, borderTopColor: theme.colors.border, borderTopWidth: 1, paddingTop: 6, paddingBottom: 8, height: 60 },
      tabBarActiveTintColor: theme.colors.primary, tabBarInactiveTintColor: theme.colors.fgMuted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
    }}>
      <Tabs.Screen name="index" options={{ title: "Front Desk", tabBarIcon: ({ color, size }) => <Gauge size={size} color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Check In", tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} /> }} />
      <Tabs.Screen name="leads" options={{ title: "Leads", tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} /> }} />
      <Tabs.Screen name="payments" options={{ title: "Payments", tabBarIcon: ({ color, size }) => <CreditCard size={size} color={color} /> }} />
      <Tabs.Screen name="register" options={{ title: "Register", tabBarIcon: ({ color, size }) => <UserRoundPlus size={size} color={color} /> }} />
    </Tabs>
  );
}

export default function ReceptionLayout() {
  const { theme } = useTheme();
  const { isAuthenticated } = useRBAC();
  useEffect(() => { if (!isAuthenticated) router.replace("/auth/login"); }, [isAuthenticated]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: theme.colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="leads" />
      <Stack.Screen name="leads/add" />
      <Stack.Screen name="leads/[id]" />
      <Stack.Screen name="register" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="appointments" />
      <Stack.Screen name="trials" />
      <Stack.Screen name="trials/[id]" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="visitors" />
      <Stack.Screen name="followups" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="crm-dashboard" />
    </Stack>
  );
}
