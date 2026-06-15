import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { memberNotificationService } from "@/services/notification-service";
import { Bell, CheckCheck, Calendar, CreditCard, Dumbbell, Megaphone, Apple, AlertTriangle, Settings, Filter } from "lucide-react-native";
import type { Notification } from "@/types";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  renewal: <Calendar size={18} />, attendance: <Calendar size={18} />, payment: <CreditCard size={18} />,
  class: <Calendar size={18} />, trainer: <Dumbbell size={18} />, system: <Bell size={18} />,
  promotion: <Megaphone size={18} />, announcement: <Megaphone size={18} />, campaign: <Bell size={18} />,
  lead: <Bell size={18} />,
};

const TYPE_FILTERS = ["all", "renewal", "payment", "attendance", "trainer", "announcement", "system"];

export default function NotificationCenterScreen() {
  const { theme } = useTheme(); const { profile } = useAuth();
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    if (!profile?.id) return;
    try { setNotifications(await memberNotificationService.getNotifications(profile.id)); } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id: string) => { await memberNotificationService.markAsRead(id); setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))); };
  const handleMarkAllRead = async () => { if (profile?.id) { await memberNotificationService.markAllAsRead(profile.id); setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); } };

  if (loading) return <LoadingState fullScreen />;

  const filtered = typeFilter === "all" ? notifications : notifications.filter((n) => n.type === typeFilter);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text variant="h2">Notifications</Text>
          {unread > 0 && <Text variant="bodySmall" muted>{unread} unread</Text>}
        </View>
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          {unread > 0 && <Button variant="ghost" size="sm" onPress={handleMarkAllRead}><CheckCheck size={16} /></Button>}
          <TouchableOpacity onPress={() => router.push("/member/settings")}><Settings size={20} color={theme.colors.fgMuted} /></TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: theme.spacing.lg, marginBottom: theme.spacing.md }}>
        {TYPE_FILTERS.map((f) => (
          <TouchableOpacity key={f} onPress={() => setTypeFilter(f)}
            style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.full, marginRight: 4, backgroundColor: typeFilter === f ? theme.colors.primary : theme.colors.bgSurfaceMuted }}>
            <Text variant="caption" color={typeFilter === f ? "#fff" : theme.colors.fg}>{f === "all" ? "All" : f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}>
        {filtered.length === 0 ? <EmptyState icon={<Bell size={48} />} title="No notifications" description={`No ${typeFilter === "all" ? "" : typeFilter} notifications.`} />
          : filtered.map((n) => (
            <TouchableOpacity key={n.id} activeOpacity={0.7} onPress={() => handleMarkRead(n.id)}>
              <Card variant={n.read ? "default" : "muted"}>
                <CardContent style={{ flexDirection: "row", gap: theme.spacing.md }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: n.read ? theme.colors.bgSurfaceMuted : theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    {TYPE_ICONS[n.type] ?? <Bell size={18} color={n.read ? theme.colors.fgMuted : theme.colors.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text variant="subtitle" style={{ flex: 1, fontWeight: n.read ? "400" : "700" }}>{n.title}</Text>
                      {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 6 }} />}
                    </View>
                    <Text variant="bodySmall" muted style={{ marginTop: 2 }}>{n.body}</Text>
                    <Text variant="caption" muted style={{ marginTop: 4 }}>
                      {n.priority === "high" || n.priority === "urgent" ? <Text variant="caption" color={theme.colors.danger}>● </Text> : null}
                      {new Date(n.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </CardContent>
              </Card>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
}
