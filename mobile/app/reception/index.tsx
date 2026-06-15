import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useRBAC } from "@/hooks/use-rbac";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { getSupabaseClient } from "@/api/supabase";
import { CalendarCheck, UserPlus, CreditCard, Users, MessageSquare, CalendarDays } from "lucide-react-native";

export default function ReceptionDashboardScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({
    todayCheckIns: 0, todayRegistrations: 0, pendingRenewals: 0,
    todayPayments: 0, todayLeads: 0, upcomingClasses: 0,
    pendingPayments: 0, recentActivities: 0,
  });

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!profile?.gym_id) return;

      const today = new Date().toISOString().split("T")[0];
      const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const [checkIns, registrations, renewals, payments, leads, classes, pendingPay, activities] = await Promise.all([
        supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).gte("check_in_at", today),
        supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).gte("joined_at", today),
        supabase.from("memberships").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).eq("status", "active").lte("end_date", weekEnd),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).gte("created_at", today),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).gte("created_at", today),
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).eq("status", "active"),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).in("status", ["pending", "processing", "failed"]),
        supabase.from("activity_events").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).gte("created_at", today),
      ]);

      setMetrics({
        todayCheckIns: checkIns.count ?? 0,
        todayRegistrations: registrations.count ?? 0,
        pendingRenewals: renewals.count ?? 0,
        todayPayments: payments.count ?? 0,
        todayLeads: leads.count ?? 0,
        upcomingClasses: classes.count ?? 0,
        pendingPayments: pendingPay.count ?? 0,
        recentActivities: activities.count ?? 0,
      });
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  const quickActions = [
    { label: "Register Member", icon: <UserPlus size={20} />, href: "/reception/register" },
    { label: "Check In", icon: <CalendarCheck size={20} />, href: "/reception/attendance" },
    { label: "Collect Payment", icon: <CreditCard size={20} />, href: "/reception/payments" },
    { label: "Send Reminder", icon: <MessageSquare size={20} />, href: "/reception/register" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="caption" muted uppercase>Front Desk</Text>
        <Text variant="h2">Reception Dashboard</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMetrics(); }} tintColor={theme.colors.primary} />}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Today's Check-Ins" value={metrics.todayCheckIns} icon={<CalendarCheck size={20} />} />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Registrations" value={metrics.todayRegistrations} icon={<UserPlus size={20} />} detail="Today" />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Pending Renewals" value={metrics.pendingRenewals} icon={<Users size={20} />} detail="Due within 7 days" />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Today's Payments" value={metrics.todayPayments} icon={<CreditCard size={20} />} />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="New Leads" value={metrics.todayLeads} icon={<MessageSquare size={20} />} detail="Today" />
          </View>
          <View style={{ width: "47%" }}>
            <AdminKpiCard label="Upcoming Classes" value={metrics.upcomingClasses} icon={<CalendarDays size={20} />} />
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

        <Card>
          <CardContent>
            <EmptyState title="All clear" description="Renewals, follow-ups, and pending tasks will appear here." />
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
