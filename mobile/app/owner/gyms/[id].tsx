import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { adminGymService } from "@/services/admin/gym-service";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, Building2, MapPin, Users, Dumbbell, CreditCard, ChevronRight } from "lucide-react-native";
import type { Gym, Branch, Trainer } from "@/types";

export default function GymDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [gym, setGym] = useState<Gym | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [stats, setStats] = useState({ members: 0, activeMembers: 0, staff: 0, revenue: 0 });

  useEffect(() => { loadDetail(); }, [id]);

  const loadDetail = async () => {
    try {
      const g = await adminGymService.getGym(id);
      setGym(g);
      if (g) {
        const [b, t, d] = await Promise.all([
          adminGymService.getBranches(g.id),
          adminGymService.getGymTrainers(g.id),
          adminGymService.getGymDashboard(g.id),
        ]);
        setBranches(b);
        setTrainers(t);
        setStats({ members: d.totalMembers, activeMembers: d.activeMembers, staff: d.totalStaff, revenue: d.monthlyRevenue });
      }
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;
  if (!gym) return <Text>Gym not found</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">{gym.name}</Text>
        <Badge variant={gym.status === "active" ? "success" : "neutral"} label={gym.status} size="sm" />
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Members" value={stats.members} icon={<Users size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Active" value={stats.activeMembers} icon={<Users size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Trainers" value={trainers.length} icon={<Dumbbell size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Monthly Rev" value={`₹${stats.revenue.toLocaleString()}`} icon={<CreditCard size={20} />} /></View>
        </View>

        <Text variant="h4">Branches ({branches.length})</Text>
        {branches.map((b) => (
          <Card key={b.id} variant="muted">
            <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text variant="subtitle">{b.name}</Text>
                <Text variant="caption" muted>{b.city}{b.state ? `, ${b.state}` : ""} · {b.branch_code}</Text>
              </View>
              <Badge variant={b.status === "active" ? "success" : "neutral"} label={b.status} size="sm" />
            </CardContent>
          </Card>
        ))}

        <Text variant="h4">Trainers ({trainers.length})</Text>
        {trainers.map((t) => (
          <Card key={t.id} variant="muted">
            <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                <Text variant="subtitle" color={theme.colors.primary}>{t.display_name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="subtitle">{t.display_name}</Text>
                <Text variant="caption" muted>{t.specialization ?? "Trainer"}</Text>
              </View>
              <Badge variant={t.status === "active" ? "success" : "neutral"} label={t.status} size="sm" />
            </CardContent>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
