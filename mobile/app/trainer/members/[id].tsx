import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, Dumbbell, Apple, TrendingUp, Calendar, MessageSquare } from "lucide-react-native";
import type { Member } from "@/types";

export default function TrainerMemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [stats, setStats] = useState({ workouts: 0, attendance: 0, sessions: 0 });

  useEffect(() => { loadDetail(); }, [id]);

  const loadDetail = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: m } = await supabase.from("members").select("*").eq("id", id).maybeSingle();
      setMember(m as Member);
      if (m) {
        const [workouts, attendance, sessions] = await Promise.all([
          supabase.from("workout_logs").select("id", { count: "exact", head: true }).eq("member_id", id).gte("logged_at", new Date(Date.now() - 30 * 86400000).toISOString()),
          supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("member_id", id).gte("check_in_at", new Date(Date.now() - 30 * 86400000).toISOString()),
          supabase.from("trainer_sessions").select("id").eq("member_id", id).gte("session_date", new Date().toISOString().split("T")[0]),
        ]);
        setStats({ workouts: workouts.count ?? 0, attendance: attendance.count ?? 0, sessions: sessions.data?.length ?? 0 });
      }
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;
  if (!member) return <Text>Member not found</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{member.full_name}</Text>
          <Text variant="caption" muted>{member.member_code} · {member.phone}</Text>
        </View>
        <Badge variant={member.status === "active" ? "success" : "neutral"} label={member.status} />
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "30%" }}><AdminKpiCard label="30d Workouts" value={stats.workouts} icon={<Dumbbell size={16} />} /></View>
          <View style={{ width: "30%" }}><AdminKpiCard label="30d Visits" value={stats.attendance} icon={<Calendar size={16} />} /></View>
          <View style={{ width: "30%" }}><AdminKpiCard label="Upcoming" value={stats.sessions} icon={<Calendar size={16} />} /></View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button variant="primary" fullWidth onPress={() => router.push(`/trainer/programs/add?memberId=${id}`)}>
            <Dumbbell size={18} color={theme.colors.primaryFg} /> Assign Workout
          </Button>
          <Button variant="secondary" fullWidth onPress={() => router.push(`/trainer/progress/${id}`)}>
            <TrendingUp size={18} /> View Progress
          </Button>
          <Button variant="secondary" fullWidth onPress={() => {}}>
            <MessageSquare size={18} /> Send Message
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
