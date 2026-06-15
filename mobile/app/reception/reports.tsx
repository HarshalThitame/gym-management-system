import React, { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { getSupabaseClient } from "@/api/supabase";
import { BarChart3, Users, CalendarCheck, CreditCard } from "lucide-react-native";

export default function ReceptionReportsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ registrations: 0, checkins: 0, payments: 0 });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (!profile?.gym_id) return;
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split("T")[0];
      const [reg, ci, pay] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).gte("joined_at", today),
        supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).gte("check_in_at", today),
        supabase.from("payments").select("amount").eq("gym_id", profile.gym_id).eq("status", "paid").gte("created_at", today),
      ]);
      setStats({
        registrations: reg.count ?? 0,
        checkins: ci.count ?? 0,
        payments: ((pay.data ?? []) as any[]).reduce((s: number, p: any) => s + (p.amount ?? 0), 0),
      });
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Daily Report</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Registrations" value={stats.registrations} icon={<Users size={20} />} detail="Today" /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Check-Ins" value={stats.checkins} icon={<CalendarCheck size={20} />} detail="Today" /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Revenue" value={`₹${stats.payments.toLocaleString()}`} icon={<CreditCard size={20} />} detail="Today" /></View>
        </View>
      </ScrollView>
    </View>
  );
}
