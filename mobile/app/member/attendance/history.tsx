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
import { attendanceService } from "@/services/attendance-service";
import { ArrowLeft, CalendarCheck } from "lucide-react-native";
import type { AttendanceSession } from "@/types";

export default function AttendanceHistoryScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (member) {
        const h = await attendanceService.getHistory(member.id, 90);
        setSessions(h);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  const grouped = sessions.reduce<Record<string, AttendanceSession[]>>((acc, s) => {
    const date = new Date(s.check_in_at).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(s);
    return acc;
  }, {});

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.fg} />
          </TouchableOpacity>
          <Text variant="h2">Attendance History</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        {Object.keys(grouped).length === 0 ? (
          <EmptyState title="No visits yet" description="Your check-in history will appear here." />
        ) : (
          Object.entries(grouped).map(([date, daySessions]) => (
            <Card key={date} variant="muted">
              <CardContent style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                  <CalendarCheck size={16} color={theme.colors.primary} />
                  <Text variant="subtitle">{new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</Text>
                </View>
                {daySessions.map((s) => (
                  <View key={s.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingLeft: 24 }}>
                    <Text variant="bodySmall" muted>
                      {new Date(s.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      {s.check_out_at ? ` - ${new Date(s.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : " (active)"}
                    </Text>
                    <Badge variant={s.status === "completed" ? "success" : "warning"} label={s.status} size="sm" />
                  </View>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}


