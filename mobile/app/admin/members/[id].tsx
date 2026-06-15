import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, User, Calendar, CreditCard, TrendingUp, Dumbbell, MessageSquare } from "lucide-react-native";
import type { Member } from "@/types";

export default function AdminMemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [stats, setStats] = useState({ membership: "N/A", payments: 0, attendance: 0 });

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: m } = await supabase.from("members").select("*").eq("id", id).maybeSingle();
      setMember(m as Member);
      if (m) {
        const [mem, pay, att] = await Promise.all([
          supabase.from("memberships").select("status").eq("member_id", id).eq("status", "active").maybeSingle(),
          supabase.from("payments").select("amount").eq("member_id", id).eq("status", "paid"),
          supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("member_id", id).gte("check_in_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        ]);
        setStats({
          membership: (mem.data as any)?.status ?? "None",
          payments: ((pay.data ?? []) as any[]).reduce((s: number, p: any) => s + (p.amount ?? 0), 0),
          attendance: att.count ?? 0,
        });
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
          <View style={{ width: "30%" }}><AdminKpiCard label="Membership" value={stats.membership.toUpperCase()} /></View>
          <View style={{ width: "30%" }}><AdminKpiCard label="30d Visits" value={stats.attendance} /></View>
          <View style={{ width: "30%" }}><AdminKpiCard label="Lifetime Pay" value={`₹${stats.payments.toLocaleString()}`} /></View>
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Button variant="primary" fullWidth onPress={() => {}}><Calendar size={18} color="#fff" /> Manage Membership</Button>
          <Button variant="secondary" fullWidth onPress={() => {}}><CreditCard size={18} /> Payment History</Button>
          <Button variant="secondary" fullWidth onPress={() => {}}><Dumbbell size={18} /> Assign Trainer</Button>
          <Button variant="secondary" fullWidth onPress={() => {}}><MessageSquare size={18} /> Send Message</Button>
        </View>
      </ScrollView>
    </View>
  );
}
