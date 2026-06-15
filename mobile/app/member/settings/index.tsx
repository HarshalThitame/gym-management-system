import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { useAppStore } from "@/state/app/app-store";
import { commPreferenceService } from "@/services/communication/comm-preferences";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Bell, Moon, Globe, Shield, LogOut, ChevronRight,
  Smartphone, Trash2, Info, CircleHelp,
} from "lucide-react-native";

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { user, profile, logout } = useAuth();
  const { theme: themePref, setTheme } = useAppStore();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      commPreferenceService.getPreferences(profile.id).then((p) => {
        setPushEnabled(p.push_enabled);
        setEmailEnabled(p.email_enabled);
      }).catch(() => {});
    }
  }, [profile?.id]);

  const togglePush = async () => {
    const next = !pushEnabled;
    setPushEnabled(next);
    if (profile?.id) await commPreferenceService.updatePreferences(profile.id, { push_enabled: next });
  };

  const toggleEmail = async () => {
    const next = !emailEnabled;
    setEmailEnabled(next);
    if (profile?.id) await commPreferenceService.updatePreferences(profile.id, { email_enabled: next });
  };
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/auth/login");
          },
        },
      ]
    );
  }, [logout]);

  const themeOptions: { label: string; value: "system" | "light" | "dark" }[] = [
    { label: "System", value: "system" },
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
  ];

  const currentThemePref = themePref as "system" | "light" | "dark";

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 100 }}>
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="caption" muted uppercase style={{ paddingLeft: theme.spacing.xs }}>Preferences</Text>

          <Card variant="muted">
            <CardContent style={{ gap: theme.spacing.md }}>
              <SettingRow
                icon={<Moon size={20} />}
                label="Theme"
                  value={themeOptions.find((o) => o.value === currentThemePref)?.label ?? "System"}
                  onPress={() => {
                    const nextIndex = (themeOptions.findIndex((o) => o.value === currentThemePref) + 1) % themeOptions.length;
                    const next = themeOptions[nextIndex];
                    if (next) setTheme(next.value);
                  }}
              />
              <SettingRow
                icon={<Bell size={20} />}
                label="Push Notifications"
                value={pushEnabled ? "Enabled" : "Disabled"}
                onPress={togglePush}
              />
              <SettingRow
                icon={<Bell size={20} />}
                label="Email Notifications"
                value={emailEnabled ? "Enabled" : "Disabled"}
                onPress={toggleEmail}
              />
              <SettingRow
                icon={<Globe size={20} />}
                label="Language"
                value="English"
                onPress={() => {}}
              />
            </CardContent>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Text variant="caption" muted uppercase style={{ paddingLeft: theme.spacing.xs }}>Account</Text>

          <Card variant="muted">
            <CardContent style={{ gap: theme.spacing.md }}>
              <SettingRow
                icon={<Info size={20} />}
                label="Account Info"
                value={user?.email ?? ""}
                onPress={() => router.push("/member/profile")}
              />
              <SettingRow
                icon={<Shield size={20} />}
                label="Privacy"
                value="Data & consent"
                onPress={() => {}}
              />
              <SettingRow
                icon={<Smartphone size={20} />}
                label="App Version"
                value="1.0.0"
                onPress={() => {}}
                showArrow={false}
              />
            </CardContent>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Text variant="caption" muted uppercase style={{ paddingLeft: theme.spacing.xs }}>Support</Text>

          <Card variant="muted">
            <CardContent style={{ gap: theme.spacing.md }}>
              <SettingRow
                icon={<CircleHelp size={20} />}
                label="Help & FAQ"
                value=""
                onPress={() => {}}
              />
              <SettingRow
                icon={<Info size={20} />}
                label="Terms of Service"
                value=""
                onPress={() => {}}
              />
              <SettingRow
                icon={<Shield size={20} />}
                label="Privacy Policy"
                value=""
                onPress={() => {}}
              />
            </CardContent>
          </Card>
        </View>

        <Button variant="danger" size="lg" fullWidth onPress={handleLogout}>
          <LogOut size={20} color={theme.colors.dangerFg} /> Sign Out
        </Button>
      </ScrollView>
    </View>
  );
}

function SettingRow({
  icon, label, value, onPress, showArrow = true,
}: {
  icon: React.ReactNode; label: string; value: string; onPress: () => void; showArrow?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.bgSurface, alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        {value ? <Text variant="caption" muted>{value}</Text> : null}
      </View>
      {showArrow && <ChevronRight size={18} color={theme.colors.fgMuted} />}
    </TouchableOpacity>
  );
}
