import React, { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSupabaseClient } from "@/api/supabase";
import { CreditCard } from "lucide-react-native";

export default function MembershipPlansScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    try {
      if (!profile?.gym_id) return;
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("membership_plans").select("*").eq("gym_id", profile.gym_id).order("sort_order");
      setPlans(data ?? []);
    } catch {} finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Membership Plans</Text>
        <Text variant="bodySmall" muted>{plans.length} active plans</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPlans} tintColor={theme.colors.primary} />}>
        {plans.length === 0 ? <EmptyState icon={<CreditCard size={48} />} title="No plans" description="Create membership plans to start selling memberships." />
          : plans.map((plan) => (
            <Card key={plan.id} variant="muted">
              <CardContent style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text variant="subtitle">{plan.name}</Text>
                  <Badge variant={plan.status === "active" ? "success" : "neutral"} label={plan.status} size="sm" />
                </View>
                <Text variant="h3" color={theme.colors.primary}>
                  ₹{plan.price?.toLocaleString()}
                  <Text variant="caption" muted> / {plan.plan_type?.replace("_", " ")}</Text>
                </Text>
                <Text variant="caption" muted>{plan.duration_days} days · {plan.access_level} access</Text>
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
