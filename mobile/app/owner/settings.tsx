import React from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { useAppStore } from "@/state/app/app-store";
import { Palette, Globe, Bell, Shield, Building2, ChevronRight, LogOut, FileText, Megaphone } from "lucide-react-native";

export default function OwnerSettingsScreen() {
  const { theme } = useTheme();
  const { logout } = useAuth();
  const { theme: themePref, setTheme } = useAppStore();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Organization Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 100 }}>
        <SettingSection title="Organization">
          <SettingRow icon={<Building2 size={20} />} label="Profile & Branding" onPress={() => router.push("/owner/branding")} />
          <SettingRow icon={<Palette size={20} />} label="White Label" onPress={() => router.push("/owner/branding")} />
          <SettingRow icon={<Globe size={20} />} label="Subscription" onPress={() => router.push("/owner/subscription")} />
        </SettingSection>
        <SettingSection title="Management">
          <SettingRow icon={<FileText size={20} />} label="Audit Logs" onPress={() => router.push("/owner/audit-logs")} />
          <SettingRow icon={<Megaphone size={20} />} label="Announcements" onPress={() => router.push("/owner/announcements")} />
          <SettingRow icon={<Bell size={20} />} label="Notifications" onPress={() => {}} />
        </SettingSection>
        <SettingSection title="Preferences">
          <SettingRow icon={<Globe size={20} />} label="Theme" value={themePref === "dark" ? "Dark" : themePref === "light" ? "Light" : "System"}
            onPress={() => { const next = { system: "light", light: "dark", dark: "system" }[themePref] as "system" | "light" | "dark"; setTheme(next); }} />
          <SettingRow icon={<Shield size={20} />} label="Privacy & Security" onPress={() => {}} />
        </SettingSection>
        <TouchableOpacity onPress={() => { Alert.alert("Sign Out", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Sign Out", style: "destructive", onPress: () => { logout(); router.replace("/auth/login"); } }]); }}
          style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.lg }}>
          <LogOut size={20} color={theme.colors.danger} />
          <Text variant="body" color={theme.colors.danger}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
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

function SettingRow({ icon, label, value, onPress }: { icon: React.ReactNode; label: string; value?: string; onPress: () => void }) {
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
