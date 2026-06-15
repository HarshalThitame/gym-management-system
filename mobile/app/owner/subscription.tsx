import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { adminOrganizationService } from "@/services/admin/organization-service";
import { ArrowLeft, CreditCard, Calendar, Layers } from "lucide-react-native";

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<any>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (!organizationId) return;
      const s = await adminOrganizationService.getSubscription(organizationId);
      setSub(s);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Subscription</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <CreditCard size={24} color={theme.colors.primary} />
              <Badge variant={sub?.status === "active" ? "success" : sub?.status === "trial" ? "warning" : "neutral"}
                label={sub?.status?.toUpperCase() ?? "NO PLAN"} />
            </View>
            <Text variant="h2" color={theme.colors.primary}>{(sub?.plan_tier ?? "Free").toUpperCase()}</Text>
            {sub && (
              <View style={{ gap: theme.spacing.sm }}>
                <Row label="Plan" value={sub.plan_tier} />
                <Row label="Status" value={sub.status} />
                <Row label="Started" value={new Date(sub.starts_on).toLocaleDateString("en-IN")} />
                {sub.renews_on && <Row label="Renews" value={new Date(sub.renews_on).toLocaleDateString("en-IN")} />}
                {sub.trial_ends_on && <Row label="Trial Ends" value={new Date(sub.trial_ends_on).toLocaleDateString("en-IN")} />}
              </View>
            )}
          </CardContent>
        </Card>
        {sub && (
          <Card variant="muted">
            <CardContent style={{ gap: theme.spacing.md }}>
              <Text variant="h4">Limits</Text>
              <Row label="Branch Limit" value={String(sub.branch_limit)} />
              <Row label="Member Limit" value={String(sub.member_limit)} />
              <Row label="Staff Limit" value={String(sub.staff_limit)} />
              <Row label="Storage" value={`${sub.storage_limit_mb} MB`} />
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text variant="body" muted>{label}</Text>
      <Text variant="body" bold>{value}</Text>
    </View>
  );
}
