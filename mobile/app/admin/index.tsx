import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useRBAC } from "@/hooks/use-rbac";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { adminGymService } from "@/services/admin/gym-service";
import {
  Users, CreditCard, CalendarCheck, Dumbbell,
  TrendingUp, UserPlus, ArrowRight,
} from "lucide-react-native";
import type { ActivityEvent } from "@/types";
import { getSupabaseClient } from "@/api/supabase";

export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { isGymAdmin } = useRBAC();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState({
    totalMembers: 0, activeMembers: 0, totalTrainers: 0, totalStaff: 0,
    todayCheckIns: 0, monthlyRevenue: 0, activeMemberships: 0, expiringThisWeek: 0,
  });
  const [gymName, setGymName] = useState("Gym Dashboard");
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!profile?.gym_id) return;

      const { data: gym } = await supabase.from("gyms").select("name").eq("id", profile.gym_id).maybeSingle();
      if (gym) setGymName(gym.name);

      const d = await adminGymService.getGymDashboard(profile.gym_id);
      setDashboard(d);

      const { data: events } = await supabase
        .from("activity_events")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .order("created_at", { ascending: false })
        .limit(10);

      setActivities((events ?? []) as ActivityEvent[]);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  const quickActions = [
    { label: "Add Member", icon: <UserPlus size={20} />, href: "/admin/members" },
    { label: "View Reports", icon: <TrendingUp size={20} />, href: "/admin/reports" },
    { label: "Manage Plans", icon: <CreditCard size={20} />, href: "/admin/membership-plans" },
    { label: "Staff", icon: <Users size={20} />, href: "/admin/staff" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="caption" muted uppercase>Gym Admin</Text>
        <Text variant="h2">{gymName}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} tintColor={theme.colors.primary} />}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Today's Check-Ins" value={dashboard.todayCheckIns} icon={<CalendarCheck size={20} />} detail="Members inside now" />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Active Members" value={dashboard.activeMembers} icon={<Users size={20} />} detail={`${dashboard.totalMembers} total members`} />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Revenue This Month" value={`₹${dashboard.monthlyRevenue.toLocaleString()}`} icon={<CreditCard size={20} />} detail="Paid this month" />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Expiring This Week" value={dashboard.expiringThisWeek} icon={<TrendingUp size={20} />} detail={dashboard.expiringThisWeek > 0 ? "Renewals needed" : "All memberships current"} />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Trainers" value={dashboard.totalTrainers} icon={<Dumbbell size={20} />} detail="Active trainers" />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Active Plans" value={dashboard.activeMemberships} icon={<CreditCard size={20} />} detail="Current memberships" />
          </View>
        </View>

        <Card>
          <CardContent style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                onPress={() => router.push(action.href as never)}
                style={{
                  flex: 1, minWidth: "45%",
                  flexDirection: "row", alignItems: "center", gap: theme.spacing.sm,
                  padding: theme.spacing.md,
                  backgroundColor: theme.colors.bgSurfaceMuted,
                  borderRadius: theme.radii.md,
                }}
              >
                {action.icon}
                <Text variant="bodySmall" bold>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </CardContent>
        </Card>

        <ActivityFeed activities={activities} />
      </ScrollView>
    </View>
  );
}
