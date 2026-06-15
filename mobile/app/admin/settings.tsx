import React from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { useAppStore } from "@/state/app/app-store";
import { Settings, Bell, Globe, Shield, Users, CreditCard, ChevronRight, LogOut, Dumbbell } from "lucide-react-native";

export default function GymSettingsScreen() {
  const { theme } = useTheme();
  const { logout } = useAuth();
  const { theme: themePref, setTheme } = useAppStore();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Gym Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 100 }}>
        <Section title="Management">
          <Row icon={<CreditCard size={20} />} label="Membership Plans" onPress={() => router.push("/admin/membership-plans")} />
          <Row icon={<Dumbbell size={20} />} label="Workout Templates" onPress={() => router.push("/admin/fitness")} />
          <Row icon={<Users size={20} />} label="Staff Permissions" onPress={() => router.push("/admin/staff")} />
        </Section>
        <Section title="Preferences">
          <Row icon={<Globe size={20} />} label="Theme" value={themePref === "dark" ? "Dark" : themePref === "light" ? "Light" : "System"}
            onPress={() => { const next = { system: "light", light: "dark", dark: "system" }[themePref] as "system" | "light" | "dark"; setTheme(next); }} />
          <Row icon={<Bell size={20} />} label="Notifications" onPress={() => {}} />
          <Row icon={<Shield size={20} />} label="Security" onPress={() => {}} />
        </Section>
        <TouchableOpacity onPress={() => { Alert.alert("Sign Out", "Are you sure?", [{ text: "Cancel" }, { text: "Sign Out", style: "destructive", onPress: () => { logout(); router.replace("/auth/login"); } }]); }}
          style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.lg }}>
          <LogOut size={20} color={theme.colors.danger} />
          <Text variant="body" color={theme.colors.danger}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="caption" muted uppercase style={{ paddingLeft: theme.spacing.xs }}>{title}</Text>
      <Card variant="muted">
        <CardContent style={{ gap: theme.spacing.md }}>{children}</CardContent>
      </Card>
    </View>
  );
}

function Row({ icon, label, value, onPress }: { icon: React.ReactNode; label: string; value?: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
      {icon}
      <Text variant="body" style={{ flex: 1 }}>{label}</Text>
      {value && <Text variant="caption" muted>{value}</Text>}
      <ChevronRight size={18} color={theme.colors.fgMuted} />
    </TouchableOpacity>
  );
}
