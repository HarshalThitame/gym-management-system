import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useRBAC } from "@/hooks/use-rbac";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { getSupabaseClient } from "@/api/supabase";
import { Calendar, Users, MessageSquare, Dumbbell, ChevronRight, Clock, CheckCircle2 } from "lucide-react-native";
import type { TrainerSession, Member, Trainer } from "@/types";

export default function TrainerDashboardScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [todaysSessions, setTodaysSessions] = useState<TrainerSession[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<TrainerSession[]>([]);
  const [assignedMembers, setAssignedMembers] = useState<Member[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!profile?.gym_id) return;

      const { data: trainerData } = await supabase
        .from("trainers")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .maybeSingle();

      setTrainer(trainerData as Trainer | null);

      if (trainerData) {
        const today = new Date().toISOString().split("T")[0];

        const [todayS, upcoming, members, messages] = await Promise.all([
          supabase.from("trainer_sessions").select("*, members!inner(full_name, phone, member_code)").eq("trainer_id", trainerData.id).eq("session_date", today).order("starts_at"),
          supabase.from("trainer_sessions").select("*, members!inner(full_name, phone, member_code)").eq("trainer_id", trainerData.id).gte("session_date", today).order("session_date").limit(10),
          supabase.from("trainer_assignments").select("member_id, members!inner(id, full_name, phone, member_code, photo_url)").eq("trainer_id", trainerData.id).eq("status", "active"),
          supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", profile.id).eq("read", false),
        ]);

        setTodaysSessions((todayS.data ?? []) as TrainerSession[]);
        setUpcomingSessions((upcoming.data ?? []) as TrainerSession[]);
        setAssignedMembers((members.data ?? []).map((a: any) => a.members) as Member[]);
        setUnreadMessages(messages.count ?? 0);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  const completedToday = todaysSessions.filter((s) => s.status === "completed").length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="caption" muted uppercase>Trainer Portal</Text>
        <Text variant="h2">{trainer?.display_name ?? "Trainer Dashboard"}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} tintColor={theme.colors.primary} />}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Today's Sessions" value={todaysSessions.length} icon={<Calendar size={20} />} detail={`${completedToday} completed`} />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Assigned Members" value={assignedMembers.length} icon={<Users size={20} />} />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Upcoming" value={upcomingSessions.length} icon={<Clock size={20} />} detail="Next 30 days" />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Unread Messages" value={unreadMessages} icon={<MessageSquare size={20} />} />
          </View>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text variant="h4">Today's Sessions</Text>
            <TouchableOpacity onPress={() => router.push("/trainer/schedule")}>
              <Text variant="caption" color={theme.colors.primary}>View All</Text>
            </TouchableOpacity>
          </View>

          {todaysSessions.length === 0 ? (
            <Card variant="muted">
              <CardContent>
                <EmptyState title="No sessions today" description="Your scheduled sessions will appear here." />
              </CardContent>
            </Card>
          ) : (
            todaysSessions.map((session) => (
              <Card key={session.id} variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: session.status === "completed" ? theme.colors.successMuted : theme.colors.primaryMuted,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {session.status === "completed"
                      ? <CheckCircle2 size={20} color={theme.colors.success} />
                      : <Clock size={20} color={theme.colors.primary} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">{(session as any).members?.full_name ?? "Member"}</Text>
                    <Text variant="bodySmall" muted>
                      {session.starts_at.slice(0, 5)} - {session.ends_at.slice(0, 5)}
                    </Text>
                  </View>
                  <Badge
                    variant={session.status === "completed" ? "success" : session.status === "cancelled" ? "danger" : "warning"}
                    label={session.status.replace("_", " ")}
                    size="sm"
                  />
                </CardContent>
              </Card>
            ))
          )}
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text variant="h4">Assigned Members</Text>
            <TouchableOpacity onPress={() => router.push("/trainer/members")}>
              <Text variant="caption" color={theme.colors.primary}>See All</Text>
            </TouchableOpacity>
          </View>

          {assignedMembers.length === 0 ? (
            <Card variant="muted">
              <CardContent>
                <EmptyState title="No members assigned" description="Assigned members will appear here once a gym admin links them to you." />
              </CardContent>
            </Card>
          ) : (
            assignedMembers.slice(0, 5).map((member) => (
              <TouchableOpacity key={member.id} activeOpacity={0.7}>
                <Card variant="muted">
                  <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: theme.colors.primaryMuted,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Text variant="subtitle" color={theme.colors.primary}>{member.full_name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="subtitle">{member.full_name}</Text>
                      <Text variant="caption" muted>{member.member_code}</Text>
                    </View>
                    <ChevronRight size={18} color={theme.colors.fgMuted} />
                  </CardContent>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
