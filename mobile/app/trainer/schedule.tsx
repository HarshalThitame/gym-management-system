import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSupabaseClient } from "@/api/supabase";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { Calendar, Clock, CheckCircle2, Users, ChevronRight } from "lucide-react-native";

export default function TrainerScheduleScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);

  useEffect(() => { loadSchedule(); }, []);

  const loadSchedule = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: trainer } = await supabase.from("trainers").select("id").eq("gym_id", profile?.gym_id ?? "").maybeSingle();
      if (!trainer) return;

      const today = new Date().toISOString().split("T")[0];

      const [todayS, upcoming] = await Promise.all([
        supabase.from("trainer_sessions").select("*, members!inner(full_name, member_code)").eq("trainer_id", trainer.id).eq("session_date", today).order("starts_at"),
        supabase.from("trainer_sessions").select("*, members!inner(full_name, member_code)").eq("trainer_id", trainer.id).gte("session_date", today).order("session_date").order("starts_at").limit(20),
      ]);

      setTodaySessions(todayS.data ?? []);
      setUpcomingSessions(upcoming.data ?? []);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  const completedCount = todaySessions.filter((s) => s.status === "completed").length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">My Schedule</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadSchedule} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}><AdminKpiCard label="Today" value={todaySessions.length} icon={<Calendar size={20} />} detail={`${completedCount} completed`} /></View>
          <View style={{ flex: 1 }}><AdminKpiCard label="Upcoming" value={upcomingSessions.length} icon={<Clock size={20} />} /></View>
        </View>

        {todaySessions.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Today's Sessions</Text>
            {todaySessions.map((s: any) => (
              <Card key={s.id} variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: s.status === "completed" ? theme.colors.successMuted : theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    {s.status === "completed" ? <CheckCircle2 size={22} color={theme.colors.success} /> : <Clock size={22} color={theme.colors.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">{s.members?.full_name ?? "Member"}</Text>
                    <Text variant="caption" muted>{s.starts_at.slice(0, 5)} - {s.ends_at.slice(0, 5)}</Text>
                  </View>
                  <Badge variant={s.status === "completed" ? "success" : s.status === "cancelled" ? "danger" : "warning"} label={s.status.replace("_", " ")} size="sm" />
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        {upcomingSessions.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Upcoming</Text>
            {upcomingSessions.filter((s) => s.session_date !== new Date().toISOString().split("T")[0]).slice(0, 10).map((s: any) => (
              <Card key={s.id} variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    <Calendar size={22} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">{s.members?.full_name ?? "Member"}</Text>
                    <Text variant="caption" muted>
                      {new Date(s.session_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                      {" · "}{s.starts_at.slice(0, 5)} - {s.ends_at.slice(0, 5)}
                    </Text>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        {todaySessions.length === 0 && upcomingSessions.length === 0 && (
          <EmptyState title="No sessions scheduled" description="Your schedule is clear. Sessions will appear when assigned by the gym admin." />
        )}
      </ScrollView>
    </View>
  );
}
