import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl, TextInput } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSupabaseClient } from "@/api/supabase";
import { Search, Users, ChevronRight, Dumbbell, Apple } from "lucide-react-native";
import type { Member } from "@/types";

export default function TrainerMembersScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<(Member & { hasWorkout?: boolean; hasDiet?: boolean })[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { loadMembers(); }, []);

  const loadMembers = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: trainer } = await supabase.from("trainers").select("id").eq("gym_id", profile?.gym_id ?? "").maybeSingle();
      if (!trainer) return;

      const { data: assignments } = await supabase
        .from("trainer_assignments")
        .select("member_id, members!inner(id, full_name, member_code, phone, photo_url, status)")
        .eq("trainer_id", trainer.id)
        .eq("status", "active");

      const memberList = (assignments ?? []).map((a: any) => a.members) as Member[];
      const enriched = await Promise.all(memberList.map(async (m) => {
        const [workouts, diets] = await Promise.all([
          supabase.from("workout_programs").select("id").eq("member_id", m.id).eq("status", "active").limit(1),
          supabase.from("nutrition_plans").select("id").eq("member_id", m.id).eq("status", "active").limit(1),
        ]);
        return { ...m, hasWorkout: (workouts.data ?? []).length > 0, hasDiet: (diets.data ?? []).length > 0 };
      }));
      setMembers(enriched);
    } catch {} finally { setLoading(false); }
  };

  const filtered = members.filter((m) =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) || m.member_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">My Members</Text>
        <Text variant="bodySmall" muted>{members.length} assigned</Text>
      </View>
      <View style={{ paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.bgSurface, borderRadius: theme.radii.md, paddingHorizontal: theme.spacing.md, height: 44, borderWidth: 1, borderColor: theme.colors.border }}>
          <Search size={18} color={theme.colors.fgMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search members..." placeholderTextColor={theme.colors.fgMuted} style={{ flex: 1, marginLeft: theme.spacing.sm, color: theme.colors.fg, fontSize: 14 }} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMembers} tintColor={theme.colors.primary} />}>
        {filtered.length === 0 ? <EmptyState icon={<Users size={48} />} title="No members assigned" description="Members will be assigned by the gym admin." />
          : filtered.map((m) => (
            <TouchableOpacity key={m.id} activeOpacity={0.7} onPress={() => router.push(`/trainer/members/${m.id}`)}>
              <Card variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    <Text variant="subtitle" color={theme.colors.primary}>{m.full_name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">{m.full_name}</Text>
                    <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: 2 }}>
                      {m.hasWorkout && <Dumbbell size={12} color={theme.colors.success} />}
                      {m.hasDiet && <Apple size={12} color={theme.colors.success} />}
                      <Text variant="caption" muted>{m.member_code}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={theme.colors.fgMuted} />
                </CardContent>
              </Card>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
}
