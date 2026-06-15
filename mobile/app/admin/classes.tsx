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
import { CalendarDays, Clock, Users } from "lucide-react-native";

export default function AdminClassesScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (!profile?.gym_id) return;
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("classes").select("*, trainers(display_name)").eq("gym_id", profile.gym_id).order("start_time");
      setClasses(data ?? []);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Classes</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        {classes.length === 0 ? <EmptyState icon={<CalendarDays size={48} />} title="No classes" description="Create group classes for your members." />
          : classes.map((c: any) => (
            <Card key={c.id} variant="muted">
              <CardContent style={{ gap: theme.spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text variant="subtitle">{c.name}</Text>
                  <Badge variant={c.status === "active" ? "success" : "neutral"} label={c.status} size="sm" />
                </View>
                <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
                  <Text variant="caption" muted>{c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}</Text>
                  <Text variant="caption" muted>Capacity: {c.capacity}</Text>
                </View>
                {c.trainers?.display_name && <Text variant="caption" muted>By: {c.trainers.display_name}</Text>}
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
