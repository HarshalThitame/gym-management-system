import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { subscriptionAnalyticsService, type SubscriptionAnalytics } from "@/services/analytics/subscription-analytics-service";
import { ArrowLeft, Target, AlertTriangle, TrendingUp } from "lucide-react-native";

export default function SubscriptionAnalyticsScreen() {
  const { theme } = useTheme(); const insets = useSafeAreaInsets(); const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true); const [data, setData] = useState<SubscriptionAnalytics | null>(null);
  useEffect(() => { load(); }, []);
  const load = async () => { try { if (!organizationId) return; setData(await subscriptionAnalyticsService.getSubscriptionAnalytics(organizationId)); } catch {} finally { setLoading(false); } };
  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Subscription & Limits</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text variant="h3" color={theme.colors.primary}>{(data?.planTier ?? "Free").toUpperCase()}</Text>
              <Badge variant={data?.status === "active" ? "success" : "warning"} label={data?.status ?? "N/A"} />
            </View>
            {data?.needsUpgrade && (
              <View style={{ backgroundColor: theme.colors.warningMuted, padding: theme.spacing.md, borderRadius: theme.radii.md, flexDirection: "row", gap: theme.spacing.sm }}>
                <AlertTriangle size={16} color={theme.colors.warning} />
                <Text variant="bodySmall" color={theme.colors.warning}>{data.recommendation}</Text>
              </View>
            )}
          </CardContent>
        </Card>

        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Usage</Text>
            <UsageBar label="Members" used={data?.membersUsed ?? 0} limit={data?.memberLimit ?? 100} />
            <UsageBar label="Branches" used={data?.branchesUsed ?? 0} limit={data?.branchLimit ?? 1} />
            <UsageBar label="Staff" used={data?.staffUsed ?? 0} limit={data?.staffLimit ?? 5} />
            <UsageBar label="Storage" used={data?.storageUsed ?? 0} limit={data?.storageLimit ?? 100} unit="MB" />
          </CardContent>
        </Card>

        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.sm }}>
            <Text variant="h4">Features</Text>
            <FeatureRow label="Attendance" enabled={data?.attendanceEnabled ?? false} />
            <FeatureRow label="CRM" enabled={data?.crmEnabled ?? false} />
            <FeatureRow label="AI Intelligence" enabled={data?.aiEnabled ?? false} />
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}

function UsageBar({ label, used, limit, unit = "" }: { label: string; used: number; limit: number; unit?: string }) {
  const { theme } = useTheme(); const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="bodySmall" muted>{label}</Text>
        <Text variant="bodySmall">{used}/{limit} {unit}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: pct > 80 ? theme.colors.danger : pct > 60 ? theme.colors.warning : theme.colors.success, borderRadius: 3 }} />
      </View>
    </View>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  const { theme } = useTheme();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
    <Text variant="body">{label}</Text>
    <Badge variant={enabled ? "success" : "neutral"} label={enabled ? "Enabled" : "Disabled"} size="sm" />
  </View>;
}
