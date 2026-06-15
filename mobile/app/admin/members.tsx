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
import { adminGymService } from "@/services/admin/gym-service";
import { getSupabaseClient } from "@/api/supabase";
import { Search, Plus, Users, ChevronRight } from "lucide-react-native";
import type { Member } from "@/types";

export default function AdminMembersScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { loadMembers(); }, []);

  const loadMembers = async () => {
    try {
      if (!profile?.gym_id) return;
      const m = await adminGymService.getGymMembers(profile.gym_id, 100);
      setMembers(m);
    } catch {} finally { setLoading(false); }
  };

  const filtered = members.filter((m) =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.member_code.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text variant="h2">Members</Text>
          <TouchableOpacity onPress={() => router.push("/admin/members/add")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
            <Plus size={22} color={theme.colors.primaryFg} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.bgSurface, borderRadius: theme.radii.md, paddingHorizontal: theme.spacing.md, height: 44, borderWidth: 1, borderColor: theme.colors.border }}>
          <Search size={18} color={theme.colors.fgMuted} />
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Search by name, code or phone..."
            placeholderTextColor={theme.colors.fgMuted}
            style={{ flex: 1, marginLeft: theme.spacing.sm, color: theme.colors.fg, fontSize: 14 }}
          />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMembers} tintColor={theme.colors.primary} />}>
        {filtered.length === 0 ? <EmptyState icon={<Users size={48} />} title={search ? "No matches" : "No members"} description={search ? "Try a different search." : "Add your first member to get started."} />
          : filtered.map((m) => (
            <TouchableOpacity key={m.id} activeOpacity={0.7} onPress={() => router.push(`/admin/members/${m.id}`)}>
              <Card variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    <Text variant="subtitle" color={theme.colors.primary}>{m.full_name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">{m.full_name}</Text>
                    <Text variant="caption" muted>{m.member_code} · {m.phone}</Text>
                  </View>
                  <Badge variant={m.status === "active" ? "success" : "neutral"} label={m.status} size="sm" />
                  <ChevronRight size={18} color={theme.colors.fgMuted} />
                </CardContent>
              </Card>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
}
