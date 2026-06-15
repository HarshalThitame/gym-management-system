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
import { EmptyState } from "@/components/ui/EmptyState";
import { aiInsightsService, type BusinessInsight } from "@/services/analytics/ai-insights-service";
import { ArrowLeft, Brain, TrendingUp, AlertTriangle, Info, Lightbulb, ChevronRight } from "lucide-react-native";

const TYPE_ICONS: Record<string, React.ReactNode> = { positive: <TrendingUp size={20} />, negative: <AlertTriangle size={20} />, warning: <AlertTriangle size={20} />, info: <Info size={20} /> };

export default function AIInsightsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<BusinessInsight[]>([]);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      if (!organizationId) return;
      const i = await aiInsightsService.generateInsights(organizationId);
      setInsights(i);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Brain size={24} color={theme.colors.primary} />
        <Text variant="h2">AI Business Insights</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        {insights.length === 0 ? <EmptyState icon={<Brain size={48} />} title="No insights yet" description="Insights will generate as more data becomes available." />
          : insights.map((insight, i) => (
            <Card key={i} variant="muted">
              <CardContent style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: (insight.type === "positive" ? theme.colors.successMuted : insight.type === "warning" ? theme.colors.warningMuted : theme.colors.infoMuted), alignItems: "center", justifyContent: "center" }}>
                    {TYPE_ICONS[insight.type] ?? <Info size={20} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text variant="subtitle">{insight.title}</Text>
                      <Badge variant={insight.type === "positive" ? "success" : insight.type === "warning" ? "warning" : "info"} label={insight.category} size="sm" />
                    </View>
                    <Text variant="body" muted style={{ marginTop: 4 }}>{insight.description}</Text>
                    <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm, backgroundColor: theme.colors.bgSurfaceMuted, padding: theme.spacing.sm, borderRadius: theme.radii.md }}>
                      <Lightbulb size={14} color={theme.colors.warning} />
                      <Text variant="bodySmall" style={{ flex: 1 }}>{insight.recommendation}</Text>
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
