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
import { EmptyState } from "@/components/ui/EmptyState";
import { getSupabaseClient } from "@/api/supabase";
import { membershipService } from "@/services/membership-service";
import { ArrowLeft } from "lucide-react-native";
import type { Membership } from "@/types";

export default function MembershipHistoryScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<(Membership & { membership_plans?: { name: string } })[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (member) {
        const h = await membershipService.getMembershipHistory(member.id);
        setHistory(h);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.fg} />
          </TouchableOpacity>
          <Text variant="h2">Membership History</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        {history.length === 0 ? (
          <EmptyState title="No history" description="Your past memberships will appear here." />
        ) : (
          history.map((m) => (
            <Card key={m.id} variant="muted">
              <CardContent style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text variant="subtitle">{m.membership_plans?.name ?? "Membership"}</Text>
                  <Badge
                    variant={m.status === "active" ? "success" : m.status === "expired" ? "danger" : "neutral"}
                    label={m.status.toUpperCase()}
                    dot
                  />
                </View>
                <Text variant="bodySmall" muted>
                  {new Date(m.start_date).toLocaleDateString("en-IN")} - {new Date(m.end_date).toLocaleDateString("en-IN")}
                </Text>
                {m.total_amount > 0 && <Text variant="bodySmall">₹{m.total_amount.toLocaleString()}</Text>}
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}


