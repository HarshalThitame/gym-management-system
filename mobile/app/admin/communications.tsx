import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { commAnalyticsService } from "@/services/communication/comm-analytics";
import { commAutomationService } from "@/services/communication/comm-automation";
import { MessageSquare, Mail, Smartphone, Bell, Settings, ChevronRight, Target, Megaphone, Bot, BarChart3 } from "lucide-react-native";

export default function CommunicationCenterScreen() {
  const { theme } = useTheme(); const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true); const [analytics, setAnalytics] = useState<any>(null); const [rules, setRules] = useState<any[]>([]);
  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      if (!organizationId) return;
      const [a, r] = await Promise.all([commAnalyticsService.getAnalytics(organizationId), commAutomationService.getRules(organizationId)]);
      setAnalytics(a); setRules(r);
    } catch {} finally { setLoading(false); }
  };
  if (loading) return <LoadingState fullScreen />;

  const modules = [
    { icon: <Bell size={18} />, label: "Send Notification", desc: "Push notification to members/staff", color: theme.colors.primary, route: "" },
    { icon: <Mail size={18} />, label: "Email Campaign", desc: "Create and send email campaigns", color: theme.colors.info, route: "" },
    { icon: <Smartphone size={18} />, label: "SMS & WhatsApp", desc: "Send SMS or WhatsApp messages", color: theme.colors.success, route: "" },
    { icon: <Megaphone size={18} />, label: "Announcements", desc: "Create organization announcements", color: theme.colors.warning, route: "/admin/announcements" },
    { icon: <Bot size={18} />, label: "Automation Rules", desc: `${rules.filter((r: any) => r.is_active).length} active rules`, color: theme.colors.secondary, route: "" },
    { icon: <BarChart3 size={18} />, label: "Analytics", desc: `${analytics?.totalSent ?? 0} sent today`, color: theme.colors.accent, route: "" },
    { icon: <Settings size={18} />, label: "Templates", desc: `${analytics?.templatesCount ?? 0} templates`, color: theme.colors.danger, route: "" },
    { icon: <Target size={18} />, label: "Preferences", desc: "Notification channel settings", color: theme.colors.info, route: "/member/settings" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="caption" muted uppercase>Communication Center</Text>
        <Text variant="h2">Messages & Notifications</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Sent Today" value={analytics?.totalSent ?? 0} icon={<Bell size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Active Rules" value={rules.filter((r: any) => r.is_active).length} icon={<Bot size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Campaigns Active" value={analytics?.campaignsActive ?? 0} icon={<Target size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Templates" value={analytics?.templatesCount ?? 0} icon={<MessageSquare size={20} />} /></View>
        </View>

        <Card>
          <CardContent style={{ gap: theme.spacing.sm }}>
            <Text variant="h4">Communication Tools</Text>
            {modules.map((m, i) => (
              <TouchableOpacity key={i} onPress={() => m.route ? router.push(m.route as never) : {}}
                style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.sm, borderBottomWidth: i < modules.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: m.color + "20", alignItems: "center", justifyContent: "center" }}>{m.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text variant="body">{m.label}</Text>
                  <Text variant="caption" muted>{m.desc}</Text>
                </View>
                <ChevronRight size={16} color={theme.colors.fgMuted} />
              </TouchableOpacity>
            ))}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
